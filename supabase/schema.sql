-- Nates Gym — the canonical schema. One shot, run in the Supabase SQL editor
-- (the app's publishable key cannot DDL).
--
-- Reference data (muscles, modalities, equipment) lives in TypeScript under
-- src/lib/data/ where the id unions make typos compile errors. Only data that
-- grows or gets edited at runtime lives here. FKs into reference data
-- (modality_id, muscle_id, band_id) are plain text validated in app code
-- against those unions.
--
-- The exercise catalog is database-backed (authored at /exercises); its
-- muscle/modality/equipment ids remain TS-union text validated in app code.
--
-- People are managed in the app at /users — this file creates empty tables.
-- The exercise tables start empty too: seed them with the "Import seed
-- catalog" button at /exercises (from src/lib/data/exercises.ts).

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
  -- Conditioning rows (Echo Bike): "<rounds>x<work s>/<rest s>" or null for a
  -- steady piece timed by duration_seconds, plus the default target.
  interval_scheme text,
  target_watts int,
  target_rpm int,
  primary key (routine_id, sort_order),
  constraint routine_exercises_conditioning_check check (
    (interval_scheme is null or interval_scheme ~ '^\d{1,2}x\d{1,3}/\d{1,3}$')
    and (target_watts is null or target_watts between 1 and 2000)
    and (target_rpm is null or target_rpm between 1 and 250))
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
  notes text not null default '',
  -- Conditioning pieces: what the person aimed at (feeds their next target)
  -- and what the console read after STOP. Distance reuses distance_feet.
  interval_scheme text,
  target_watts int,
  target_rpm int,
  avg_watts int,
  max_watts int,
  avg_rpm int,
  calories int,
  constraint set_logs_conditioning_check check (
    (interval_scheme is null or interval_scheme ~ '^\d{1,2}x\d{1,3}/\d{1,3}$')
    and (target_watts is null or target_watts between 1 and 2000)
    and (target_rpm is null or target_rpm between 1 and 250)
    and (avg_watts is null or avg_watts between 0 and 3000)
    and (max_watts is null or max_watts between 0 and 3000)
    and (avg_rpm is null or avg_rpm between 0 and 300)
    and (calories is null or calories between 0 and 5000))
);

create table weigh_ins (
  id text primary key,
  client_id text not null,
  date date not null,
  bodyweight_lbs double precision not null
);

-- Runs: their own table, not set_logs — a run is distance × time with a
-- pace, never sets/reps/load, and must stay out of lifting volume and the
-- heat map. Imported from Strava (external_id = "strava:<activity id>",
-- unique so a re-sync never duplicates) or logged by hand.
create table if not exists runs (
  id text primary key,
  client_id text not null,
  date date not null,
  distance_miles double precision not null check (distance_miles > 0),
  duration_seconds int not null check (duration_seconds > 0),
  kind text not null default 'easy' check (kind in ('easy', 'long', 'workout', 'race')),
  avg_heart_rate int,
  elevation_gain_ft int,
  name text not null default '',
  source text not null default 'manual' check (source in ('manual', 'strava', 'garmin')),
  external_id text unique,
  notes text not null default ''
);
create index if not exists runs_client_idx on runs (client_id, date);

-- Clients live in the database (not TS reference data) so people can be added
-- and edited at /users, each with a card color. Ids stay readable text slugs.
-- The client_id FKs are added after every table exists (see "Integrity").
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

-- Exercise catalog: database-backed so movements can be authored at
-- /exercises. Ids are readable text slugs; set_logs/routine_exercises keep
-- referencing exercise_id as plain text (no FK), so history survives even if
-- a catalog row is edited.
create table exercises (
  id text primary key,
  name text not null,
  pattern text not null check (pattern in
    ('squat', 'hinge', 'lunge', 'push_h', 'push_v', 'pull_h', 'pull_v',
     'carry', 'core', 'isolation', 'mobility', 'conditioning')),
  metric_type text not null check (metric_type in ('reps', 'time', 'distance')),
  is_compound boolean not null default false,
  -- Alternative names ("Overhead Press" for Shoulder Press) — searched by the
  -- picker and checked by the duplicate guard, never displayed as the title.
  aliases text[] not null default '{}'
);

-- Authored once per exercise; modality muscleModifiers adjust these in app
-- code, they never re-author them. mobility exercises have no rows on purpose.
create table exercise_muscle_scores (
  exercise_id text not null references exercises(id) on delete cascade,
  muscle_id text not null,
  score int not null check (score between 0 and 10),
  primary key (exercise_id, muscle_id)
);

-- One row per exercise x modality pair ("variant"). An exercise with no
-- variants is invisible in the picker and can't be prescribed or logged.
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
  -- Dumbbells moved per rep (goblet squat = 1); null = infer from unilateral mode.
  implements smallint check (implements in (1, 2)),
  -- The lifter's bodyweight is part of the load (dumbbell-weighted pull-up).
  load_includes_bodyweight boolean not null default false,
  notes text not null default '',
  primary key (exercise_id, modality_id)
);

-- Nutrition: the household food catalog. `category` is a text FK into the
-- TS reference data (src/lib/data/food-categories.ts), validated in app code
-- like exercise_id. Values are kcal/macros for a FULL single-layer 10 1/16"
-- Dixie plate of the food (drinks: a full 12 oz glass); logs scale by the
-- covered plate fraction.
create table foods (
  id text primary key,
  name text not null,
  category text not null,
  plate_kcal double precision not null,
  plate_protein_g double precision not null,
  plate_carbs_g double precision not null,
  plate_fat_g double precision not null
);

create table food_logs (
  id text primary key,
  client_id text not null,
  date date not null,
  food_id text not null references foods(id),
  plate_fraction double precision not null
    check (plate_fraction > 0 and plate_fraction <= 1),
  -- Snapshot at log time so later food edits never rewrite eating history.
  kcal double precision not null,
  protein_g double precision not null,
  carbs_g double precision not null,
  fat_g double precision not null
);

create index set_logs_session_idx on set_logs (session_id, position);
create index sessions_client_idx on sessions (client_id, date);
create index weigh_ins_client_idx on weigh_ins (client_id, date);
-- Exact-duplicate guard for the food catalog ("Chicken breast" vs "chicken breast").
create unique index foods_name_idx on foods (lower(name));
create index food_logs_client_idx on food_logs (client_id, date);
-- Same duplicate guard for the exercise catalog.
create unique index exercises_name_idx on exercises (lower(name));
-- At most one default variant per exercise.
create unique index exercise_modalities_default_idx
  on exercise_modalities (exercise_id) where is_default;

-- Integrity the app relies on (mirrors supabase/migrations/2026-11-16-hardening.sql).
-- Every client_id references a real person; deleting someone with history fails.
alter table assignments add constraint assignments_client_fk foreign key (client_id) references clients(id);
alter table sessions add constraint sessions_client_fk foreign key (client_id) references clients(id);
alter table weigh_ins add constraint weigh_ins_client_fk foreign key (client_id) references clients(id);
alter table food_logs add constraint food_logs_client_fk foreign key (client_id) references clients(id);
alter table runs add constraint runs_client_fk foreign key (client_id) references clients(id);
-- Performed order is unique per session; deferred so sync_set_logs can
-- renumber a whole session inside one transaction.
alter table set_logs add constraint set_logs_session_position_key
  unique (session_id, position) deferrable initially deferred;
alter table set_logs add constraint set_logs_values_check check (
  position >= 1 and set_number >= 1
  and (reps is null or reps >= 0)
  and (weight_lbs is null or weight_lbs >= 0)
  and (added_weight_lbs is null or added_weight_lbs >= 0)
  and (duration_seconds is null or duration_seconds >= 0)
  and (distance_feet is null or distance_feet >= 0)
  and (rir is null or rir between 0 and 10));
alter table routine_exercises add constraint routine_exercises_values_check check (
  sets between 1 and 20
  and rest_seconds >= 0
  and (rep_min is null or rep_max is null or rep_min <= rep_max));
alter table programs add constraint programs_weeks_check check (weeks between 1 and 52);
alter table weigh_ins add constraint weigh_ins_bodyweight_check check (bodyweight_lbs > 0);
alter table foods add constraint foods_macros_check
  check (plate_kcal >= 0 and plate_protein_g >= 0 and plate_carbs_g >= 0 and plate_fat_g >= 0);
alter table food_logs add constraint food_logs_macros_check
  check (kcal >= 0 and protein_g >= 0 and carbs_g >= 0 and fat_g >= 0);
-- One active program per person.
create unique index assignments_one_active_idx on assignments (client_id) where status = 'active';
-- Behind the delete-guards' reference checks.
create index program_days_routine_idx on program_days (routine_id);
create index sessions_routine_idx on sessions (routine_id);
create index sessions_assignment_idx on sessions (assignment_id);
create index assignments_client_idx on assignments (client_id);
create index set_logs_exercise_idx on set_logs (exercise_id);

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

-- Atomic multi-table writes (PostgREST has no client-side transactions).
-- Rows arrive as JSON in each table's exact snake_case shape
-- (src/lib/db/mappers.ts), so jsonb_populate_recordset maps them.
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
    notes = excluded.notes,
    interval_scheme = excluded.interval_scheme,
    target_watts = excluded.target_watts,
    target_rpm = excluded.target_rpm,
    avg_watts = excluded.avg_watts,
    max_watts = excluded.max_watts,
    avg_rpm = excluded.avg_rpm,
    calories = excluded.calories;
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
    'assignments', 'sessions', 'set_logs', 'weigh_ins', 'clients',
    'foods', 'food_logs',
    'exercises', 'exercise_muscle_scores', 'exercise_modalities', 'runs'
  ] loop
    execute format('alter table %I enable row level security', t);
    execute format(
      'create policy anon_all on %I for all to anon, authenticated using (true) with check (true)',
      t
    );
  end loop;
end $$;

-- Starter food catalog — 48 household staples so day-one logging is picking,
-- not creating. Values are per FULL 10 1/16" plate (drinks: 12 oz glass),
-- curated rough estimates. Idempotent: safe to re-run.
insert into foods (id, name, category, plate_kcal, plate_protein_g, plate_carbs_g, plate_fat_g) values
  ('f_chicken_breast',   'Chicken breast',        'lean_protein', 800,  150, 0,   18),
  ('f_turkey_breast',    'Turkey breast',         'lean_protein', 750,  145, 0,   12),
  ('f_white_fish',       'White fish (tilapia/cod)', 'lean_protein', 650, 130, 0, 12),
  ('f_shrimp',           'Shrimp',                'lean_protein', 600,  125, 2,   8),
  ('f_pork_tenderloin',  'Pork tenderloin',       'lean_protein', 850,  145, 0,   25),
  ('f_canned_tuna',      'Canned tuna',           'lean_protein', 700,  140, 0,   10),
  ('f_ground_beef',      'Ground beef (85/15)',   'fatty_protein', 1250, 100, 0,  90),
  ('f_salmon',           'Salmon',                'fatty_protein', 1100, 110, 0,  70),
  ('f_chicken_thighs',   'Chicken thighs',        'fatty_protein', 1100, 110, 0,  70),
  ('f_steak',            'Steak (sirloin)',       'fatty_protein', 1100, 130, 0,  60),
  ('f_scrambled_eggs',   'Scrambled eggs',        'fatty_protein', 700,  48,  4,  48),
  ('f_bacon',            'Bacon',                 'fatty_protein', 1600, 100, 4,  130),
  ('f_white_rice',       'White rice',            'starchy_carb', 900,  18,  195, 4),
  ('f_brown_rice',       'Brown rice',            'starchy_carb', 850,  18,  180, 6),
  ('f_pasta',            'Pasta',                 'starchy_carb', 950,  33,  185, 6),
  ('f_mashed_potatoes',  'Mashed potatoes',       'starchy_carb', 800,  12,  130, 25),
  ('f_baked_potato',     'Baked potato',          'starchy_carb', 700,  16,  155, 1),
  ('f_oatmeal',          'Oatmeal',               'starchy_carb', 600,  20,  105, 12),
  ('f_bread',            'Bread',                 'starchy_carb', 400,  16,  76,  5),
  ('f_tortillas',        'Tortillas',             'starchy_carb', 700,  18,  115, 16),
  ('f_pancakes',         'Pancakes',              'starchy_carb', 900,  20,  150, 25),
  ('f_cereal',           'Cereal',                'starchy_carb', 550,  10,  120, 5),
  ('f_broccoli',         'Broccoli',              'veggie', 150, 12, 28, 2),
  ('f_salad_greens',     'Salad greens',          'veggie', 80,  5,  12, 1),
  ('f_green_beans',      'Green beans',           'veggie', 150, 8,  30, 1),
  ('f_carrots',          'Carrots',               'veggie', 180, 4,  42, 1),
  ('f_corn',             'Corn',                  'veggie', 400, 12, 90, 5),
  ('f_mixed_vegetables', 'Mixed vegetables',      'veggie', 200, 8,  40, 2),
  ('f_banana',           'Banana',                'fruit', 320, 4, 80, 1),
  ('f_apple',            'Apple',                 'fruit', 300, 2, 80, 1),
  ('f_berries',          'Berries',               'fruit', 250, 3, 60, 1),
  ('f_grapes',           'Grapes',                'fruit', 350, 3, 90, 1),
  ('f_pizza',            'Pizza',                 'fried_fatty', 1500, 60, 150, 75),
  ('f_french_fries',     'French fries',          'fried_fatty', 1300, 15, 170, 60),
  ('f_fried_chicken',    'Fried chicken',         'fried_fatty', 1400, 85, 60,  90),
  ('f_cheeseburger',     'Cheeseburger',          'fried_fatty', 1200, 60, 90,  65),
  ('f_mac_and_cheese',   'Mac and cheese',        'fried_fatty', 1300, 45, 140, 60),
  ('f_ice_cream',        'Ice cream',             'dessert', 1200, 20, 140, 65),
  ('f_cookies',          'Cookies',               'dessert', 1800, 20, 240, 85),
  ('f_cake',             'Cake',                  'dessert', 1600, 18, 220, 70),
  ('f_cheese',           'Cheese',                'dairy', 1500, 90, 10, 120),
  ('f_greek_yogurt',     'Greek yogurt',          'dairy', 500,  50, 30, 15),
  ('f_cottage_cheese',   'Cottage cheese',        'dairy', 450,  55, 15, 12),
  ('f_milk',             'Milk (12 oz glass)',    'drink', 220, 12, 18, 12),
  ('f_orange_juice',     'Orange juice (12 oz)',  'drink', 170, 2,  40, 0),
  ('f_soda',             'Soda (12 oz can)',      'drink', 150, 0,  40, 0),
  ('f_protein_shake',    'Protein shake',         'drink', 200, 30, 8,  3),
  ('f_coffee_with_cream','Coffee with cream',     'drink', 50,  1,  2,  5)
on conflict (id) do nothing;
