-- Blank-slate reset. NOT part of the schema — run pieces of this by hand in
-- the Supabase SQL editor. Deletes are permanent; there is no undo.
--
-- The app tolerates empty tables everywhere.

-- ---------------------------------------------------------------------------
-- 1. ALWAYS: wipe workout history — sessions, logged sets, and program
--    assignments. This is the "start tracking for real tomorrow" reset.
-- ---------------------------------------------------------------------------
truncate table set_logs, sessions, assignments;

-- ---------------------------------------------------------------------------
-- 2. OPTIONAL: also wipe the planning layer (programs + routines).
--    Skip this if you want to keep the routines/programs you built.
-- ---------------------------------------------------------------------------
-- truncate table program_days, programs, routine_exercises, routines;

-- ---------------------------------------------------------------------------
-- 3. OPTIONAL: also wipe weigh-ins. Bodyweight drives bodyweight-exercise
--    e1RMs, BW+added prefills, and dumbbell-weighted pull-up loads, so log a
--    fresh weigh-in per person afterwards (People › Tracking).
-- ---------------------------------------------------------------------------
-- truncate table weigh_ins;

-- ---------------------------------------------------------------------------
-- 4. OPTIONAL: also wipe people. Skip this — you just set them up with
--    colors at /users. The table still exists afterwards, so the app shows
--    an EMPTY roster (no seed fallback — that only happens while the table is
--    missing) until you add people back at /users. Everything with a
--    client_id references clients, so their history goes with them:
-- ---------------------------------------------------------------------------
-- truncate table clients, runs, weigh_ins, food_logs, set_logs, sessions, assignments;

-- ---------------------------------------------------------------------------
-- 5. OPTIONAL: also wipe the exercise catalog. Because the tables still
--    exist, the app does NOT fall back to the TS seed — the catalog is just
--    empty until you press "Import seed catalog" at /exercises. Note
--    set_logs/routine_exercises reference exercise_id as plain text, so this
--    truncate succeeds even with history present (which then renders raw ids).
-- ---------------------------------------------------------------------------
-- truncate table exercise_modalities, exercise_muscle_scores, exercises;

-- ---------------------------------------------------------------------------
-- 6. OPTIONAL: also wipe nutrition. food_logs is eating history; foods is the
--    catalog — wiping foods leaves nutrition unusable until you re-run
--    schema.sql's starter foods insert (idempotent) or add foods in the app.
-- ---------------------------------------------------------------------------
-- truncate table food_logs;
-- truncate table foods cascade;
