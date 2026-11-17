-- Hardening (2026-11-16). Idempotent: safe to run more than once in the
-- Supabase SQL editor. schema.sql already includes all of this for fresh
-- installs; run this file only on a database created before it.
--
-- What it does:
--   1. Moves client card colors onto the softer presets (src/lib/data/clients.ts).
--   2. Enforces in the database what the app already assumes: every client_id
--      points at a real client, set positions are unique per session, one
--      active program per person, sane numeric ranges.
--   3. Adds indexes behind the delete-guards' reference checks.
--   4. Adds atomic write functions, so a multi-step save can never half-apply
--      (PostgREST has no client-side transactions; each function is one).
--   5. Allows Garmin as a run source.

-- ---------------------------------------------------------------------------
-- 1. Client colors: pure RGB presets → status-safe presets
-- ---------------------------------------------------------------------------
update clients set color = '#6366f1' where upper(color) = '#FF0000'; -- red    → indigo
update clients set color = '#14b8a6' where upper(color) = '#00FF00'; -- green  → teal
update clients set color = '#06b6d4' where upper(color) = '#0000FF'; -- blue   → cyan
update clients set color = '#8b5cf6' where upper(color) = '#B200ED'; -- purple → violet
update clients set color = '#f97316' where upper(color) = '#FFFF00'; -- yellow → orange

-- ---------------------------------------------------------------------------
-- 2. Constraints (each added only if missing)
-- ---------------------------------------------------------------------------
create or replace function pg_temp.add_constraint(t regclass, c text, def text)
returns void language plpgsql as $$
begin
  if not exists (select 1 from pg_constraint where conrelid = t and conname = c) then
    execute format('alter table %s add constraint %I %s', t, c, def);
  end if;
end $$;

-- Every client_id references a real person. Restrict (the default): deleting
-- someone with history fails, which the app already refuses up front.
select pg_temp.add_constraint('assignments', 'assignments_client_fk', 'foreign key (client_id) references clients(id)');
select pg_temp.add_constraint('sessions', 'sessions_client_fk', 'foreign key (client_id) references clients(id)');
select pg_temp.add_constraint('weigh_ins', 'weigh_ins_client_fk', 'foreign key (client_id) references clients(id)');
select pg_temp.add_constraint('food_logs', 'food_logs_client_fk', 'foreign key (client_id) references clients(id)');
select pg_temp.add_constraint('runs', 'runs_client_fk', 'foreign key (client_id) references clients(id)');

-- Performed order is unique per session. Deferred, so sync_set_logs can
-- renumber a whole session inside one transaction.
select pg_temp.add_constraint('set_logs', 'set_logs_session_position_key',
  'unique (session_id, position) deferrable initially deferred');
select pg_temp.add_constraint('set_logs', 'set_logs_values_check', $c$check (
  position >= 1 and set_number >= 1
  and (reps is null or reps >= 0)
  and (weight_lbs is null or weight_lbs >= 0)
  and (added_weight_lbs is null or added_weight_lbs >= 0)
  and (duration_seconds is null or duration_seconds >= 0)
  and (distance_feet is null or distance_feet >= 0)
  and (rir is null or rir between 0 and 10))$c$);

select pg_temp.add_constraint('routine_exercises', 'routine_exercises_values_check', $c$check (
  sets between 1 and 20
  and rest_seconds >= 0
  and (rep_min is null or rep_max is null or rep_min <= rep_max))$c$);
select pg_temp.add_constraint('programs', 'programs_weeks_check', 'check (weeks between 1 and 52)');
select pg_temp.add_constraint('weigh_ins', 'weigh_ins_bodyweight_check', 'check (bodyweight_lbs > 0)');
select pg_temp.add_constraint('foods', 'foods_macros_check',
  'check (plate_kcal >= 0 and plate_protein_g >= 0 and plate_carbs_g >= 0 and plate_fat_g >= 0)');
select pg_temp.add_constraint('food_logs', 'food_logs_macros_check',
  'check (kcal >= 0 and protein_g >= 0 and carbs_g >= 0 and fat_g >= 0)');

-- Runs can come from Garmin too.
alter table runs drop constraint if exists runs_source_check;
alter table runs add constraint runs_source_check check (source in ('manual', 'strava', 'garmin'));

-- One active program per person.
create unique index if not exists assignments_one_active_idx
  on assignments (client_id) where status = 'active';

-- ---------------------------------------------------------------------------
-- 3. Indexes for the delete-guards and per-person reads
-- ---------------------------------------------------------------------------
create index if not exists program_days_routine_idx on program_days (routine_id);
create index if not exists sessions_routine_idx on sessions (routine_id);
create index if not exists sessions_assignment_idx on sessions (assignment_id);
create index if not exists assignments_client_idx on assignments (client_id);
create index if not exists set_logs_exercise_idx on set_logs (exercise_id);

-- ---------------------------------------------------------------------------
-- 4. Atomic writes. Rows arrive as JSON in the exact snake_case shape of the
--    table (src/lib/db/mappers.ts), so jsonb_populate_recordset maps them.
-- ---------------------------------------------------------------------------

-- A session's whole set list: rows missing from p_rows are deleted, the rest
-- upserted — one transaction, so renumbering never trips the unique position.
create or replace function sync_set_logs(p_session text, p_rows jsonb)
returns void language plpgsql as $$
begin
  if exists (
    select 1 from jsonb_array_elements(p_rows) r
    where r->>'session_id' is distinct from p_session
  ) or exists (
    select 1 from set_logs s
    join jsonb_array_elements(p_rows) r on s.id = r->>'id'
    where s.session_id <> p_session
  ) then
    raise exception 'set belongs to another session';
  end if;

  delete from set_logs
  where session_id = p_session
    and id not in (select r->>'id' from jsonb_array_elements(p_rows) r);

  insert into set_logs
  select * from jsonb_populate_recordset(null::set_logs, p_rows)
  on conflict (id) do update set
    position = excluded.position,
    exercise_id = excluded.exercise_id,
    modality_id = excluded.modality_id,
    set_number = excluded.set_number,
    unilateral_mode = excluded.unilateral_mode,
    side = excluded.side,
    reps = excluded.reps,
    weight_lbs = excluded.weight_lbs,
    added_weight_lbs = excluded.added_weight_lbs,
    band_id = excluded.band_id,
    band_role = excluded.band_role,
    duration_seconds = excluded.duration_seconds,
    distance_feet = excluded.distance_feet,
    rir = excluded.rir,
    is_warmup = excluded.is_warmup,
    completed = excluded.completed,
    notes = excluded.notes;
end $$;

-- An exercise's basics, muscle scores, and variants together. An UPDATE of
-- the exercise row (never an upsert): a save racing a delete must fail, not
-- resurrect it.
create or replace function save_exercise(p_exercise jsonb, p_scores jsonb, p_modalities jsonb)
returns void language plpgsql as $$
declare
  ex exercises;
begin
  ex := jsonb_populate_record(null::exercises, p_exercise);
  update exercises
  set name = ex.name, aliases = ex.aliases, pattern = ex.pattern,
      metric_type = ex.metric_type, is_compound = ex.is_compound
  where id = ex.id;
  if not found then raise exception 'exercise % not found', ex.id; end if;

  delete from exercise_muscle_scores where exercise_id = ex.id;
  insert into exercise_muscle_scores
  select * from jsonb_populate_recordset(null::exercise_muscle_scores, p_scores);

  delete from exercise_modalities where exercise_id = ex.id;
  insert into exercise_modalities
  select * from jsonb_populate_recordset(null::exercise_modalities, p_modalities);
end $$;

-- A routine and its prescriptions together. p_create inserts the routine row
-- (duplicate, care import); otherwise it must already exist.
create or replace function save_routine(p_routine jsonb, p_rows jsonb, p_create boolean default false)
returns void language plpgsql as $$
declare
  r routines;
begin
  r := jsonb_populate_record(null::routines, p_routine);
  if p_create then
    insert into routines select r.*;
  else
    update routines set name = r.name, notes = r.notes where id = r.id;
    if not found then raise exception 'routine % not found', r.id; end if;
    delete from routine_exercises where routine_id = r.id;
  end if;
  insert into routine_exercises
  select * from jsonb_populate_recordset(null::routine_exercises, p_rows);
end $$;

-- Assign a program: the person's other active assignments complete in the
-- same transaction, so there is never zero or two active.
create or replace function assign_program(p_id text, p_program text, p_client text, p_start date)
returns void language plpgsql as $$
begin
  update assignments set status = 'completed'
  where client_id = p_client and status = 'active';
  insert into assignments (id, program_id, client_id, start_date, status)
  values (p_id, p_program, p_client, p_start, 'active');
end $$;

create or replace function set_assignment_status(p_id text, p_status text)
returns void language plpgsql as $$
declare
  c text;
begin
  select client_id into c from assignments where id = p_id for update;
  if c is null then raise exception 'assignment % not found', p_id; end if;
  if p_status = 'active' then
    update assignments set status = 'completed'
    where client_id = c and status = 'active' and id <> p_id;
  end if;
  update assignments set status = p_status where id = p_id;
end $$;

-- Append a week at the end — empty, or a copy of p_copy_from's layout.
create or replace function add_program_week(p_program text, p_copy_from int, p_max int)
returns void language plpgsql as $$
declare
  n int;
begin
  select weeks into n from programs where id = p_program for update;
  if n is null then raise exception 'program % not found', p_program; end if;
  if n >= p_max then raise exception 'Programs cap at % weeks.', p_max; end if;
  if p_copy_from is not null and (p_copy_from < 1 or p_copy_from > n) then
    raise exception 'week % out of range', p_copy_from;
  end if;

  update programs set weeks = n + 1 where id = p_program;
  if p_copy_from is not null then
    insert into program_days (program_id, week, day_of_week, routine_id)
    select program_id, n + 1, day_of_week, routine_id
    from program_days where program_id = p_program and week = p_copy_from;
  end if;
end $$;

-- PostgREST caches the schema; make the new functions callable right away.
notify pgrst, 'reload schema';
