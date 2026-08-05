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
    'foods', 'food_logs'
  ] loop
    execute format('alter table %I enable row level security', t);
    execute format(
      'create policy anon_all on %I for all to anon, authenticated using (true) with check (true)',
      t
    );
  end loop;
end $$;

-- Starter food catalog — ~40 household staples so day-one logging is picking,
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
