-- Exercise cues (2026-11-18). Idempotent: safe to run more than once in the
-- Supabase SQL editor. schema.sql already includes all of this for fresh
-- installs; run this file only on a database created before it.
--
-- What it does:
--   1. Adds exercises.cues (up to 3 short coaching cues — "Explain exercise").
--   2. Replaces save_exercise with a version that also saves cues (the old
--      3-argument one is dropped, so a stale call fails loudly instead of
--      silently dropping cues).
--   3. Adds fill_exercise_cues, used by /exercises "Fill cues" to load the
--      built-in cues into exercises that have none yet.

-- ---------------------------------------------------------------------------
-- 1. Column
-- ---------------------------------------------------------------------------
alter table exercises add column if not exists cues text[] not null default '{}';
alter table exercises drop constraint if exists exercises_cues_check;
alter table exercises add constraint exercises_cues_check check (cardinality(cues) <= 3);

-- ---------------------------------------------------------------------------
-- 2. save_exercise with cues
-- ---------------------------------------------------------------------------
drop function if exists save_exercise(jsonb, jsonb, jsonb);

create or replace function save_exercise(p_exercise jsonb, p_scores jsonb, p_modalities jsonb, p_cues text[])
returns void language plpgsql as $$
declare
  ex exercises;
begin
  ex := jsonb_populate_record(null::exercises, p_exercise);
  update exercises
  set name = ex.name, aliases = ex.aliases, pattern = ex.pattern,
      metric_type = ex.metric_type, is_compound = ex.is_compound,
      cues = coalesce(p_cues, '{}')
  where id = ex.id;
  if not found then raise exception 'exercise % not found', ex.id; end if;

  delete from exercise_muscle_scores where exercise_id = ex.id;
  insert into exercise_muscle_scores
  select * from jsonb_populate_recordset(null::exercise_muscle_scores, p_scores);

  delete from exercise_modalities where exercise_id = ex.id;
  insert into exercise_modalities
  select * from jsonb_populate_recordset(null::exercise_modalities, p_modalities);
end $$;

-- ---------------------------------------------------------------------------
-- 3. fill_exercise_cues
-- ---------------------------------------------------------------------------
create or replace function fill_exercise_cues(p_rows jsonb)
returns void language plpgsql as $$
begin
  update exercises e
  set cues = r.cues
  from jsonb_to_recordset(p_rows) as r(id text, cues text[])
  where e.id = r.id and cardinality(e.cues) = 0;
end $$;

notify pgrst, 'reload schema';
