-- Migration: exercise catalog moves from TypeScript to the database.
-- Run once in the Supabase SQL editor (the app's publishable key cannot DDL),
-- then use the "Import seed catalog" button at /exercises to fill the tables
-- from src/lib/data/exercises.ts.
--
-- No row migration needed: set_logs.exercise_id and
-- routine_exercises.exercise_id are plain text with no FK, and every id
-- already logged matches a seed catalog id.
--
-- Fresh installs don't need this file — schema.sql already contains these
-- tables.

create table exercises (
  id text primary key,
  name text not null,
  pattern text not null check (pattern in
    ('squat', 'hinge', 'lunge', 'push_h', 'push_v', 'pull_h', 'pull_v',
     'carry', 'core', 'isolation', 'mobility')),
  metric_type text not null check (metric_type in ('reps', 'time', 'distance')),
  is_compound boolean not null default false
);

create table exercise_muscle_scores (
  exercise_id text not null references exercises(id) on delete cascade,
  muscle_id text not null,
  score int not null check (score between 0 and 10),
  primary key (exercise_id, muscle_id)
);

create table exercise_modalities (
  exercise_id text not null references exercises(id) on delete cascade,
  modality_id text not null,
  is_default boolean not null default false,
  band_roles text[] not null default '{}',
  default_unilateral_mode text not null default 'bilateral'
    check (default_unilateral_mode in ('bilateral', 'alternating', 'single_side')),
  required_equipment text[] not null default '{}',
  pin_risk boolean not null default false,
  load_factor_override double precision,
  notes text not null default '',
  primary key (exercise_id, modality_id)
);

create unique index exercises_name_idx on exercises (lower(name));
-- At most one default variant per exercise.
create unique index exercise_modalities_default_idx
  on exercise_modalities (exercise_id) where is_default;

-- RLS: same permissive anon policy as every other table (see schema.sql).
do $$
declare
  t text;
begin
  foreach t in array array[
    'exercises', 'exercise_muscle_scores', 'exercise_modalities'
  ] loop
    execute format('alter table %I enable row level security', t);
    execute format(
      'create policy anon_all on %I for all to anon, authenticated using (true) with check (true)',
      t
    );
  end loop;
end $$;
