-- Conditioning (2026-11-17). Idempotent: safe to run more than once in the
-- Supabase SQL editor. schema.sql already includes all of this for fresh
-- installs; run this file only on a database created before it.
--
-- What it does:
--   1. Allows the 'conditioning' movement pattern (Echo Bike and friends).
--   2. Adds bike targets to routine rows and bike targets + console readouts
--      to set logs (all nullable — strength rows leave them empty).
--   3. Teaches sync_set_logs to save the new columns.
--   4. Data fix: a dumbbell/barbell set logged at 0 lb is a bodyweight set
--      (set numbers restart where that splits an exercise block).

-- ---------------------------------------------------------------------------
-- 1. Movement pattern
-- ---------------------------------------------------------------------------
alter table exercises drop constraint if exists exercises_pattern_check;
alter table exercises add constraint exercises_pattern_check check (pattern in
  ('squat', 'hinge', 'lunge', 'push_h', 'push_v', 'pull_h', 'pull_v',
   'carry', 'core', 'isolation', 'mobility', 'conditioning'));

-- ---------------------------------------------------------------------------
-- 2. Columns. interval_scheme is "<rounds>x<work s>/<rest s>" ("8x20/10");
--    null means a steady piece timed by duration_seconds.
-- ---------------------------------------------------------------------------
alter table routine_exercises
  add column if not exists interval_scheme text,
  add column if not exists target_watts int,
  add column if not exists target_rpm int;

alter table set_logs
  add column if not exists interval_scheme text,
  add column if not exists target_watts int,
  add column if not exists target_rpm int,
  add column if not exists avg_watts int,
  add column if not exists max_watts int,
  add column if not exists avg_rpm int,
  add column if not exists calories int;

create or replace function pg_temp.add_constraint(t regclass, c text, def text)
returns void language plpgsql as $$
begin
  if not exists (select 1 from pg_constraint where conrelid = t and conname = c) then
    execute format('alter table %s add constraint %I %s', t, c, def);
  end if;
end $$;

select pg_temp.add_constraint('routine_exercises', 'routine_exercises_conditioning_check',
  $c$check (
    (interval_scheme is null or interval_scheme ~ '^\d{1,2}x\d{1,3}/\d{1,3}$')
    and (target_watts is null or target_watts between 1 and 2000)
    and (target_rpm is null or target_rpm between 1 and 250))$c$);
select pg_temp.add_constraint('set_logs', 'set_logs_conditioning_check',
  $c$check (
    (interval_scheme is null or interval_scheme ~ '^\d{1,2}x\d{1,3}/\d{1,3}$')
    and (target_watts is null or target_watts between 1 and 2000)
    and (target_rpm is null or target_rpm between 1 and 250)
    and (avg_watts is null or avg_watts between 0 and 3000)
    and (max_watts is null or max_watts between 0 and 3000)
    and (avg_rpm is null or avg_rpm between 0 and 300)
    and (calories is null or calories between 0 and 5000))$c$);

-- ---------------------------------------------------------------------------
-- 3. sync_set_logs: same as before plus the new columns in the upsert.
-- ---------------------------------------------------------------------------
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
    notes = excluded.notes,
    interval_scheme = excluded.interval_scheme,
    target_watts = excluded.target_watts,
    target_rpm = excluded.target_rpm,
    avg_watts = excluded.avg_watts,
    max_watts = excluded.max_watts,
    avg_rpm = excluded.avg_rpm,
    calories = excluded.calories;
end $$;

-- ---------------------------------------------------------------------------
-- 4. 0 lb dumbbell/barbell sets → bodyweight (where that variant exists).
--    The app now does this when such a set is logged.
-- ---------------------------------------------------------------------------
update set_logs s
set modality_id = 'bodyweight', weight_lbs = null, added_weight_lbs = null
where s.modality_id in ('dumbbell', 'barbell')
  and s.weight_lbs = 0
  and s.completed
  and exists (
    select 1 from exercise_modalities em
    where em.exercise_id = s.exercise_id and em.modality_id = 'bodyweight'
  );

-- A converted set can split its exercise block (0 lb then 25 lb), so restart
-- set_number per block the way the app's renumber() does. Only rows whose
-- number is off are touched.
with marked as (
  select id, session_id, position,
    case when lag(exercise_id) over w = exercise_id
          and lag(modality_id) over w = modality_id then 0 else 1 end as starts
  from set_logs
  window w as (partition by session_id order by position)
), blocks as (
  select id, session_id, position,
    sum(starts) over (partition by session_id order by position) as block
  from marked
), numbered as (
  select id, row_number() over (partition by session_id, block order by position) as n
  from blocks
)
update set_logs s set set_number = numbered.n
from numbered
where s.id = numbered.id and s.set_number <> numbered.n;

notify pgrst, 'reload schema';
