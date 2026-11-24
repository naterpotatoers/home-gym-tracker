-- Bike effort (2026-11-23). Idempotent: safe to run more than once in the
-- Supabase SQL editor. schema.sql already includes this for fresh installs;
-- run this file only on a database created before it.
--
-- What it does:
--   1. Adds set_logs.effort — how hard a bike piece felt, 1–10 (nullable).
--   2. Teaches sync_set_logs to save it.
--
-- Until this runs, the app still starts and saves sessions; only picking an
-- effort on a bike piece asks for this file.

-- ---------------------------------------------------------------------------
-- 1. Column + check
-- ---------------------------------------------------------------------------
alter table set_logs add column if not exists effort int;

create or replace function pg_temp.add_constraint(t regclass, c text, def text)
returns void language plpgsql as $$
begin
  if not exists (select 1 from pg_constraint where conrelid = t and conname = c) then
    execute format('alter table %s add constraint %I %s', t, c, def);
  end if;
end $$;

select pg_temp.add_constraint('set_logs', 'set_logs_effort_check',
  'check (effort is null or effort between 1 and 10)');

-- ---------------------------------------------------------------------------
-- 2. sync_set_logs: same as 2026-11-17 plus effort in the upsert.
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
    calories = excluded.calories,
    effort = excluded.effort;
end $$;

notify pgrst, 'reload schema';
