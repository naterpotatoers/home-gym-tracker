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
-- 3. OPTIONAL: also wipe weigh-ins. CAUTION — the app currently has no UI to
--    add weigh-ins back, and bodyweight drives bodyweight-exercise e1RMs,
--    BW+added prefills, and the ×BW comparison column. Keeping the latest
--    row per person is recommended; wipe only if you'll reinsert manually:
--    insert into weigh_ins (id, client_id, date, bodyweight_lbs)
--    values ('wi_nate_fresh', 'nate', '2026-08-03', 185);
-- ---------------------------------------------------------------------------
-- truncate table weigh_ins;

-- ---------------------------------------------------------------------------
-- 4. OPTIONAL: also wipe people. Skip this — you just set them up with
--    colors at /users. (Wiping makes the app fall back to the read-only
--    seed roster until you add people back at /users.)
-- ---------------------------------------------------------------------------
-- truncate table clients;

-- ---------------------------------------------------------------------------
-- 5. OPTIONAL: also wipe the exercise catalog. Because the tables still
--    exist, the app does NOT fall back to the TS seed — the catalog is just
--    empty until you press "Import seed catalog" at /exercises. Note
--    set_logs/routine_exercises reference exercise_id as plain text, so this
--    truncate succeeds even with history present (which then renders raw ids).
-- ---------------------------------------------------------------------------
-- truncate table exercise_modalities, exercise_muscle_scores, exercises;
