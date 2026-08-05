-- Nates Gym — the canonical schema. One shot, run in the Supabase SQL editor
-- (the app's publishable key cannot DDL).
--
-- Reference data (muscles, modalities, equipment, exercises, muscle scores,
-- exercise modalities) lives in TypeScript under src/lib/data/ where the id
-- unions make typos compile errors. Only data that grows or gets edited at
-- runtime lives here. FKs into reference data (exercise_id, modality_id,
-- band_id) are plain text validated in app code against those unions.
--
-- People are managed in the app at /users — this file creates empty tables
-- and seeds nothing.

create table routines (
  id text primary key,
  name text not null,
  notes text not null default ''
);

-- "order" is a reserved word; the app maps sort_order <-> RoutineExercise.order.
create table routine_exercises (
  routine_id text not null references routines(id) on delete cascade,
  sort_order int not null,
  exercise_id text not null,
  modality_id text not null,
  band_role text check (band_role in ('resistance', 'assistance')),
  unilateral_mode text not null default 'bilateral'
    check (unilateral_mode in ('bilateral', 'alternating', 'single_side')),
  sets int not null,
  rep_min int,
  rep_max int,
  duration_seconds int,
  rest_seconds int not null default 90,
  target_rir int,
  superset_group text,
  notes text not null default '',
  primary key (routine_id, sort_order)
);

create table programs (
  id text primary key,
  name text not null,
  weeks int not null,
  notes text not null default ''
);

create table program_days (
  program_id text not null references programs(id) on delete cascade,
  week int not null check (week >= 1),
  day_of_week int not null check (day_of_week between 1 and 7),
  routine_id text not null references routines(id),
  primary key (program_id, week, day_of_week)
);

create table assignments (
  id text primary key,
  program_id text not null references programs(id),
  client_id text not null,
  start_date date not null,
  status text not null default 'active'
    check (status in ('active', 'completed', 'paused'))
);

create table sessions (
  id text primary key,
  client_id text not null,
  date date not null,
  assignment_id text references assignments(id),
  routine_id text references routines(id),
  duration_minutes int,
  -- Optional end-of-session check-in: how hard it was and how the body felt.
  -- Separate on purpose — an easy load can feel hard on a tired day.
  rpe int check (rpe between 1 and 10),
  condition text check (condition in ('rough', 'tired', 'normal', 'good', 'great')),
  status text not null default 'planned'
    check (status in ('planned', 'completed', 'skipped')),
  notes text not null default ''
);

create table set_logs (
  id text primary key,
  session_id text not null references sessions(id) on delete cascade,
  -- Session-wide performed order. blocksFor() groups consecutive sets by
  -- exercise+modality, which is only defined if performed order survives the
  -- round-trip through the database.
  position int not null,
  exercise_id text not null,
  modality_id text not null,
  set_number int not null,
  unilateral_mode text not null default 'bilateral'
    check (unilateral_mode in ('bilateral', 'alternating', 'single_side')),
  side text check (side in ('left', 'right')),
  reps int,
  weight_lbs double precision,
  added_weight_lbs double precision,
  band_id text,
  band_role text check (band_role in ('resistance', 'assistance')),
  duration_seconds int,
  distance_feet int,
  rir int,
  is_warmup boolean not null default false,
  completed boolean not null default false,
  notes text not null default ''
);

create table weigh_ins (
  id text primary key,
  client_id text not null,
  date date not null,
  bodyweight_lbs double precision not null
);

-- Clients live in the database (not TS reference data) so people can be added
-- and edited at /users, each with a card color. Ids stay readable text slugs;
-- other tables keep referencing client_id as plain text.
create table clients (
  id text primary key,
  first_name text not null,
  last_name text not null default '',
  status text not null default 'active' check (status in ('active', 'inactive')),
  join_date date not null,
  date_of_birth date not null,
  height_inches numeric not null,
  experience_level text not null check (experience_level in ('beginner', 'intermediate', 'advanced')),
  goal text not null check (goal in ('general-fitness', 'strength', 'hypertrophy', 'fat-loss')),
  is_trainer boolean not null default false,
  color text,
  notes text not null default ''
);

create index set_logs_session_idx on set_logs (session_id, position);
create index sessions_client_idx on sessions (client_id, date);
create index weigh_ins_client_idx on weigh_ins (client_id, date);

-- RLS: enabled with a permissive anon policy on every table. This is a
-- single-household personal app behind a publishable key; there is no
-- per-user data to segregate. The policy exists so the publishable key keeps
-- working with RLS on — without one, RLS would silently return zero rows.
do $$
declare
  t text;
begin
  foreach t in array array[
    'routines', 'routine_exercises', 'programs', 'program_days',
    'assignments', 'sessions', 'set_logs', 'weigh_ins', 'clients'
  ] loop
    execute format('alter table %I enable row level security', t);
    execute format(
      'create policy anon_all on %I for all to anon, authenticated using (true) with check (true)',
      t
    );
  end loop;
end $$;
