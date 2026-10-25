-- Audit fixes (2026-10-24). Idempotent: safe to run more than once in the
-- Supabase SQL editor. schema.sql already includes all of this for fresh
-- installs; run this file only on a database created before it.

-- Per-variant load shape (see ExerciseModality in src/lib/types.ts):
-- dumbbells moved per rep (goblet squat = 1) and whether the lifter's
-- bodyweight is part of the load (dumbbell-weighted pull-up).
alter table exercise_modalities
  add column if not exists implements smallint check (implements in (1, 2));
alter table exercise_modalities
  add column if not exists load_includes_bodyweight boolean not null default false;

-- Week-structure rewrites as single transactions, so a failure mid-shift can
-- never lose a program's schedule. The composite PK forbids in-place shifts,
-- so rows hop through a +1000 offset (still satisfies check week >= 1).
create or replace function remove_program_week(p_program text, p_week int)
returns void language plpgsql as $$
declare
  n int;
begin
  select weeks into n from programs where id = p_program for update;
  if n is null then raise exception 'program % not found', p_program; end if;
  if n <= 1 then raise exception 'A program keeps at least one week.'; end if;
  if p_week < 1 or p_week > n then raise exception 'week % out of range', p_week; end if;

  delete from program_days where program_id = p_program and week = p_week;
  update program_days set week = week + 1000 where program_id = p_program and week > p_week;
  update program_days set week = week - 1001 where program_id = p_program and week > 1000;
  update programs set weeks = n - 1 where id = p_program;
end $$;

create or replace function duplicate_program_week(p_program text, p_week int, p_max int)
returns void language plpgsql as $$
declare
  n int;
begin
  select weeks into n from programs where id = p_program for update;
  if n is null then raise exception 'program % not found', p_program; end if;
  if n >= p_max then raise exception 'Programs cap at % weeks.', p_max; end if;
  if p_week < 1 or p_week > n then raise exception 'week % out of range', p_week; end if;

  update program_days set week = week + 1000 where program_id = p_program and week > p_week;
  update program_days set week = week - 999 where program_id = p_program and week > 1000;
  insert into program_days (program_id, week, day_of_week, routine_id)
    select program_id, p_week + 1, day_of_week, routine_id
    from program_days where program_id = p_program and week = p_week;
  update programs set weeks = n + 1 where id = p_program;
end $$;

-- Backfill the built-in variants that need a non-default load shape (mirrors
-- src/lib/data/exercises.ts). The seed import is add-only per exercise, so
-- an already-imported catalog would otherwise never receive these. Only
-- touches rows still at the column defaults.
update exercise_modalities set implements = 1
  where modality_id = 'dumbbell' and implements is null
    and exercise_id in ('goblet_squat', 'russian_twist', 'pull_up', 'sit_up');
update exercise_modalities set implements = 2
  where modality_id = 'dumbbell' and implements is null
    and exercise_id in ('bulgarian_split_squat', 'step_up');
update exercise_modalities
  set load_includes_bodyweight = true,
      load_factor_override = coalesce(load_factor_override, 1)
  where modality_id = 'dumbbell' and not load_includes_bodyweight
    and exercise_id in ('pull_up', 'sit_up');
