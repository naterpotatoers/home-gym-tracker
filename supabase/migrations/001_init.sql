-- Nates Gym — initial schema for mutable data.
--
-- Reference data (muscles, modalities, equipment, exercises, muscle scores,
-- exercise modalities, clients) lives in TypeScript under src/lib/data/ where
-- the id unions make typos compile errors. Only data that grows or gets edited
-- at runtime lives here. FKs into reference data (exercise_id, modality_id,
-- client_id, band_id) are plain text validated in app code against those
-- unions.
--
-- Run this in the Supabase SQL editor (the app's publishable key cannot DDL).

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

create index set_logs_session_idx on set_logs (session_id, position);
create index sessions_client_idx on sessions (client_id, date);
create index weigh_ins_client_idx on weigh_ins (client_id, date);

-- RLS: enabled with permissive anon policies. Single-household personal app
-- behind a publishable key; there is no per-user data to segregate.
alter table routines enable row level security;
create policy anon_all on routines for all to anon, authenticated using (true) with check (true);

alter table routine_exercises enable row level security;
create policy anon_all on routine_exercises for all to anon, authenticated using (true) with check (true);

alter table programs enable row level security;
create policy anon_all on programs for all to anon, authenticated using (true) with check (true);

alter table program_days enable row level security;
create policy anon_all on program_days for all to anon, authenticated using (true) with check (true);

alter table assignments enable row level security;
create policy anon_all on assignments for all to anon, authenticated using (true) with check (true);

alter table sessions enable row level security;
create policy anon_all on sessions for all to anon, authenticated using (true) with check (true);

alter table set_logs enable row level security;
create policy anon_all on set_logs for all to anon, authenticated using (true) with check (true);

alter table weigh_ins enable row level security;
create policy anon_all on weigh_ins for all to anon, authenticated using (true) with check (true);
