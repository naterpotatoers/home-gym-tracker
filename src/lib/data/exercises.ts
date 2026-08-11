import type {
  Exercise,
  ExerciseModality,
  ExerciseMuscleScore,
  MuscleId,
} from "../types";

/**
 * Seed exercise catalog. Exercises live in the database at runtime (authored
 * at /exercises); these arrays are the read-only fallback while the tables
 * don't exist and the source for the one-time "Import seed catalog" action.
 *
 * No `muscleGroup` field — the primary muscle and group are
 * derived from `exerciseMuscleScores` so the two can never disagree. (The old
 * data already disagreed: Deadlift was tagged `back` while its scores said
 * glutes 10 / hamstrings 8 / lower_back 8, i.e. legs.)
 *
 * Overhead Press and Shoulder Press were the same movement with near-identical
 * score rows, which silently double-counted shoulder volume depending on which
 * one got logged. They are one `shoulder_press` here with barbell and dumbbell
 * modalities — and "Overhead Press" lives on as an alias, so the duplicate
 * guard blocks re-adding it and picker search still finds it. `aliases` holds
 * alternative names only; a movement that differs in loading or metric (e.g.
 * farmer_carry vs timed_carry) stays a separate exercise, never an alias.
 */
export const exercises: readonly Exercise[] = [
  // ---- squat ----
  { id: "squat", name: "Squat", aliases: ["Back Squat"], pattern: "squat", metricType: "reps", isCompound: true },
  { id: "front_squat", name: "Front Squat", pattern: "squat", metricType: "reps", isCompound: true },
  { id: "goblet_squat", name: "Goblet Squat", pattern: "squat", metricType: "reps", isCompound: true },
  { id: "wide_stance_squat", name: "Wide-Stance Squat", aliases: ["Sumo Squat"], pattern: "squat", metricType: "reps", isCompound: true },
  { id: "bulgarian_split_squat", name: "Bulgarian Split Squat", aliases: ["Rear-Foot-Elevated Split Squat", "RFESS"], pattern: "squat", metricType: "reps", isCompound: true },
  { id: "wall_sit", name: "Wall Sit", aliases: ["Wall Squat"], pattern: "squat", metricType: "time", isCompound: false },
  { id: "squat_jump", name: "Squat Jump", aliases: ["Jump Squat"], pattern: "squat", metricType: "reps", isCompound: true },
  { id: "burpee", name: "Burpee", pattern: "squat", metricType: "reps", isCompound: true },

  // ---- hinge ----
  { id: "deadlift", name: "Deadlift", aliases: ["Conventional Deadlift"], pattern: "hinge", metricType: "reps", isCompound: true },
  { id: "romanian_deadlift", name: "Romanian Deadlift", aliases: ["RDL"], pattern: "hinge", metricType: "reps", isCompound: true },
  { id: "single_leg_rdl", name: "Single-Leg Romanian Deadlift", aliases: ["Single-Leg RDL", "SLRDL"], pattern: "hinge", metricType: "reps", isCompound: true },
  { id: "good_morning", name: "Good Morning", pattern: "hinge", metricType: "reps", isCompound: true },
  { id: "back_extension", name: "Back Extension", aliases: ["Hyperextension"], pattern: "hinge", metricType: "reps", isCompound: false },
  { id: "hip_thrust", name: "Hip Thrust", pattern: "hinge", metricType: "reps", isCompound: true },
  { id: "glute_bridge", name: "Glute Bridge", pattern: "hinge", metricType: "reps", isCompound: false },
  { id: "single_leg_glute_bridge", name: "Single-Leg Glute Bridge", pattern: "hinge", metricType: "reps", isCompound: false },
  { id: "donkey_kick", name: "Donkey Kick", pattern: "hinge", metricType: "reps", isCompound: false },
  { id: "superman", name: "Superman", pattern: "hinge", metricType: "reps", isCompound: false },

  // ---- lunge ----
  { id: "lunge", name: "Lunge", pattern: "lunge", metricType: "reps", isCompound: true },
  { id: "side_lunge", name: "Side Lunge", aliases: ["Lateral Lunge"], pattern: "lunge", metricType: "reps", isCompound: true },
  { id: "step_up", name: "Step-Up", pattern: "lunge", metricType: "reps", isCompound: true },

  // ---- horizontal push ----
  { id: "bench_press", name: "Bench Press", aliases: ["Flat Bench Press"], pattern: "push_h", metricType: "reps", isCompound: true },
  { id: "incline_bench_press", name: "Incline Bench Press", pattern: "push_h", metricType: "reps", isCompound: true },
  { id: "decline_bench_press", name: "Decline Bench Press", pattern: "push_h", metricType: "reps", isCompound: true },
  { id: "floor_press", name: "Floor Press", pattern: "push_h", metricType: "reps", isCompound: true },
  { id: "push_up", name: "Push-Up", aliases: ["Pushup", "Press-Up"], pattern: "push_h", metricType: "reps", isCompound: true },
  { id: "scapular_push_up", name: "Scapular Push-Up", aliases: ["Push-Up Plus", "Scap Push-Up"], pattern: "push_h", metricType: "reps", isCompound: false },
  { id: "chest_fly", name: "Chest Fly", aliases: ["Dumbbell Fly", "Pec Fly"], pattern: "push_h", metricType: "reps", isCompound: false },

  // ---- vertical push ----
  { id: "shoulder_press", name: "Shoulder Press", aliases: ["Overhead Press", "Military Press", "OHP"], pattern: "push_v", metricType: "reps", isCompound: true },
  { id: "dip", name: "Dip", aliases: ["Parallel Bar Dip"], pattern: "push_v", metricType: "reps", isCompound: true },
  { id: "bench_dip", name: "Bench Dip", aliases: ["Tricep Dip"], pattern: "push_v", metricType: "reps", isCompound: true },

  // ---- horizontal pull ----
  { id: "bent_over_row", name: "Bent Over Row", aliases: ["Barbell Row"], pattern: "pull_h", metricType: "reps", isCompound: true },
  { id: "single_arm_row", name: "Single-Arm Row", aliases: ["Dumbbell Row", "One-Arm Row"], pattern: "pull_h", metricType: "reps", isCompound: true },
  { id: "chest_supported_row", name: "Chest-Supported Row", pattern: "pull_h", metricType: "reps", isCompound: true },
  { id: "inverted_row", name: "Inverted Row", aliases: ["Bodyweight Row", "Australian Pull-Up"], pattern: "pull_h", metricType: "reps", isCompound: true },
  { id: "face_pull", name: "Face Pull", pattern: "pull_h", metricType: "reps", isCompound: false },
  { id: "band_pull_apart", name: "Band Pull-Apart", pattern: "pull_h", metricType: "reps", isCompound: false },
  { id: "prone_ytw", name: "Prone Y-T-W", aliases: ["Y-T-W Raise", "Prone Y Raise"], pattern: "pull_h", metricType: "reps", isCompound: false },

  // ---- vertical pull ----
  { id: "pull_up", name: "Pull-Up", aliases: ["Pullup"], pattern: "pull_v", metricType: "reps", isCompound: true },
  { id: "chin_up", name: "Chin-Up", aliases: ["Chinup"], pattern: "pull_v", metricType: "reps", isCompound: true },

  // ---- isolation ----
  { id: "bicep_curl", name: "Bicep Curl", aliases: ["Biceps Curl"], pattern: "isolation", metricType: "reps", isCompound: false },
  { id: "hammer_curl", name: "Hammer Curl", pattern: "isolation", metricType: "reps", isCompound: false },
  { id: "tricep_extension", name: "Tricep Extension", aliases: ["Triceps Extension", "Skull Crusher"], pattern: "isolation", metricType: "reps", isCompound: false },
  { id: "lateral_raise", name: "Lateral Raise", aliases: ["Side Raise"], pattern: "isolation", metricType: "reps", isCompound: false },
  { id: "shrug", name: "Shrug", pattern: "isolation", metricType: "reps", isCompound: false },
  { id: "calf_raise", name: "Calf Raise", pattern: "isolation", metricType: "reps", isCompound: false },
  { id: "external_rotation", name: "External Rotation", pattern: "isolation", metricType: "reps", isCompound: false },
  { id: "band_internal_rotation", name: "Internal Rotation", pattern: "isolation", metricType: "reps", isCompound: false },
  { id: "scaption_raise", name: "Scaption Raise", aliases: ["Full-Can Raise", "Scaption"], pattern: "isolation", metricType: "reps", isCompound: false },
  { id: "band_tke", name: "Terminal Knee Extension", aliases: ["TKE", "Band TKE"], pattern: "isolation", metricType: "reps", isCompound: false },
  { id: "nordic_curl", name: "Nordic Curl", aliases: ["Nordic Hamstring Curl", "Nordic Ham Curl"], pattern: "isolation", metricType: "reps", isCompound: false },
  { id: "tibialis_raise", name: "Tibialis Raise", aliases: ["Toe Raise", "Tib Raise"], pattern: "isolation", metricType: "reps", isCompound: false },

  // ---- carry / hang ----
  { id: "farmer_carry", name: "Farmer Carry", aliases: ["Farmer's Walk", "Farmer's Carry"], pattern: "carry", metricType: "distance", isCompound: true },
  { id: "timed_carry", name: "Farmer Carry (time)", pattern: "carry", metricType: "time", isCompound: true },
  { id: "suitcase_carry", name: "Suitcase Carry", aliases: ["One-Arm Farmer Carry"], pattern: "carry", metricType: "distance", isCompound: true },
  { id: "bar_hang", name: "Bar Hang", aliases: ["Dead Hang"], pattern: "carry", metricType: "time", isCompound: false },

  // ---- core ----
  { id: "plank", name: "Plank", pattern: "core", metricType: "time", isCompound: false },
  { id: "side_plank", name: "Side Plank", pattern: "core", metricType: "time", isCompound: false },
  { id: "copenhagen_plank", name: "Copenhagen Plank", pattern: "core", metricType: "time", isCompound: false },
  { id: "pallof_press", name: "Pallof Press", pattern: "core", metricType: "reps", isCompound: false },
  { id: "hanging_knee_raise", name: "Hanging Knee Raise", pattern: "core", metricType: "reps", isCompound: false },
  { id: "hanging_leg_raise", name: "Hanging Leg Raise", pattern: "core", metricType: "reps", isCompound: false },
  { id: "lateral_walk", name: "Lateral Walk", pattern: "core", metricType: "reps", isCompound: false },
  { id: "clam_shell", name: "Banded Clam Shell", aliases: ["Clamshell", "Clam Shell"], pattern: "core", metricType: "reps", isCompound: false },
  { id: "side_lying_hip_abduction", name: "Side-Lying Hip Abduction", aliases: ["Side-Lying Leg Raise"], pattern: "core", metricType: "reps", isCompound: false },
  { id: "fire_hydrant", name: "Fire Hydrant", pattern: "core", metricType: "reps", isCompound: false },
  { id: "dead_bug", name: "Dead Bug", pattern: "core", metricType: "reps", isCompound: false },
  { id: "bird_dog", name: "Bird Dog", pattern: "core", metricType: "reps", isCompound: false },
  { id: "sit_up", name: "Sit-Up", aliases: ["Situp"], pattern: "core", metricType: "reps", isCompound: false },
  { id: "mcgill_curl_up", name: "McGill Curl-Up", aliases: ["Curl-Up"], pattern: "core", metricType: "reps", isCompound: false },
  { id: "hollow_hold", name: "Hollow Hold", aliases: ["Hollow Body Hold"], pattern: "core", metricType: "time", isCompound: false },
  { id: "russian_twist", name: "Russian Twist", pattern: "core", metricType: "reps", isCompound: false },
  { id: "bicycle_crunch", name: "Bicycle Crunch", pattern: "core", metricType: "reps", isCompound: false },
  { id: "mountain_climber", name: "Mountain Climber", aliases: ["Mountain Climbers"], pattern: "core", metricType: "reps", isCompound: false },
  { id: "woodchopper", name: "Band Woodchopper", aliases: ["Woodchopper", "Wood Chop"], pattern: "core", metricType: "reps", isCompound: false },
  // Timed conditioning — counting jacks or measuring crawl distance in a
  // garage is impractical, so both are clocked.
  { id: "jumping_jacks", name: "Jumping Jacks", aliases: ["Star Jumps"], pattern: "core", metricType: "time", isCompound: true },
  { id: "bear_crawl", name: "Bear Crawl", pattern: "core", metricType: "time", isCompound: true },

  // ---- mobility ----
  // No muscle scores on purpose. `mobility` is excluded from all volume math
  // rather than silently contributing a zero.
  // Names carry the body part so picker search ("hamstring", "hip", "back")
  // finds them. Mostly timed holds/flows (wall slides are counted in reps);
  // single_side ones log per side.
  { id: "stretch", name: "Stretch (general)", pattern: "mobility", metricType: "time", isCompound: false },
  { id: "wall_slide", name: "Wall Slide (Shoulders)", pattern: "mobility", metricType: "reps", isCompound: false },
  { id: "knee_to_wall", name: "Knee-to-Wall (Ankle)", aliases: ["Ankle Dorsiflexion Stretch"], pattern: "mobility", metricType: "time", isCompound: false },
  { id: "standing_hamstring_stretch", name: "Standing Hamstring Stretch", pattern: "mobility", metricType: "time", isCompound: false },
  { id: "standing_quad_stretch", name: "Standing Quad Stretch", pattern: "mobility", metricType: "time", isCompound: false },
  { id: "calf_stretch", name: "Calf Stretch", pattern: "mobility", metricType: "time", isCompound: false },
  { id: "butterfly_stretch", name: "Butterfly Stretch (Groin)", pattern: "mobility", metricType: "time", isCompound: false },
  { id: "figure_four_stretch", name: "Figure-Four Stretch (Glutes)", pattern: "mobility", metricType: "time", isCompound: false },
  { id: "pigeon_pose", name: "Pigeon Pose (Hips)", pattern: "mobility", metricType: "time", isCompound: false },
  { id: "ninety_ninety_stretch", name: "90/90 Hip Stretch", pattern: "mobility", metricType: "time", isCompound: false },
  { id: "kneeling_hip_flexor_stretch", name: "Kneeling Hip-Flexor Stretch", pattern: "mobility", metricType: "time", isCompound: false },
  { id: "worlds_greatest_stretch", name: "World's Greatest Stretch", pattern: "mobility", metricType: "time", isCompound: false },
  { id: "childs_pose", name: "Child's Pose (Back)", pattern: "mobility", metricType: "time", isCompound: false },
  { id: "cat_cow", name: "Cat-Cow (Spine)", pattern: "mobility", metricType: "time", isCompound: false },
  { id: "cobra_stretch", name: "Cobra Stretch (Back)", pattern: "mobility", metricType: "time", isCompound: false },
  { id: "thread_the_needle", name: "Thread the Needle (T-Spine)", pattern: "mobility", metricType: "time", isCompound: false },
  { id: "downward_dog", name: "Downward Dog", pattern: "mobility", metricType: "time", isCompound: false },
  { id: "doorway_chest_stretch", name: "Doorway Chest Stretch", pattern: "mobility", metricType: "time", isCompound: false },
  { id: "cross_body_shoulder_stretch", name: "Cross-Body Shoulder Stretch", pattern: "mobility", metricType: "time", isCompound: false },
  { id: "overhead_triceps_stretch", name: "Overhead Triceps Stretch", pattern: "mobility", metricType: "time", isCompound: false },
  { id: "standing_lat_stretch", name: "Standing Lat Stretch", pattern: "mobility", metricType: "time", isCompound: false },
  { id: "seated_forward_fold", name: "Seated Forward Fold (Hamstrings)", pattern: "mobility", metricType: "time", isCompound: false },
  { id: "standing_forward_fold", name: "Standing Forward Fold (Hamstrings)", pattern: "mobility", metricType: "time", isCompound: false },
  { id: "upward_dog", name: "Upward Dog (Front Body)", pattern: "mobility", metricType: "time", isCompound: false },
  { id: "supine_spinal_twist", name: "Supine Spinal Twist", pattern: "mobility", metricType: "time", isCompound: false },
  { id: "seated_spinal_twist", name: "Seated Spinal Twist", pattern: "mobility", metricType: "time", isCompound: false },
  { id: "happy_baby", name: "Happy Baby (Hips)", pattern: "mobility", metricType: "time", isCompound: false },
  { id: "frog_pose", name: "Frog Pose (Adductors)", pattern: "mobility", metricType: "time", isCompound: false },
  { id: "lizard_pose", name: "Lizard Pose (Hips)", pattern: "mobility", metricType: "time", isCompound: false },
  { id: "triangle_pose", name: "Triangle Pose (Hamstrings/Side)", pattern: "mobility", metricType: "time", isCompound: false },
  { id: "pancake_stretch", name: "Seated Straddle (Pancake)", pattern: "mobility", metricType: "time", isCompound: false },
];

/**
 * Score scale: 10 = primary mover, 6-8 = strong secondary, 3-5 = supporting,
 * 1-2 = stabilizer. Authored per exercise; the modality adjusts these via
 * `muscleModifiers`, it does not re-author them.
 *
 * Values follow an EMG-literature review (Aug 2026). The per-group comments
 * below name the key studies; the full evidence write-ups with links live in
 * docs/exercise-scoring-references.md (strength) and
 * docs/pt-exercise-references.md (rehab/prehab additions and the Care
 * routines) — keep them in sync when re-tuning.
 */
export const exerciseMuscleScores: readonly ExerciseMuscleScore[] = [
  // Squat scores follow the EMG literature: Gullett 2009 + Yavuz 2015 (front
  // ≈ back squat for quads; front-squat erectors NOT lower); Escamilla 2001 +
  // Paoli 2009 (stance width doesn't change quad/hamstring EMG; wide stance
  // raises glute max; adductor findings mixed); Wright 1999 (squat hamstring
  // EMG ~half of leg curl/SLDL — hamstrings are co-contractors here, hence
  // stabilizer scores); McCurdy 2010 + DeForest 2014 (Bulgarian split squat ≥
  // back squat for glute max/med at far lower load); Pandy & Zajac 1991 +
  // Farris 2016 (plantarflexors dominate jump take-off); Muyor 2020 (lunge
  // glute med ≥ glute max; unilateral > bilateral for glute med).
  // Squat
  s("squat", "quads", 10), s("squat", "glutes", 7), s("squat", "adductors", 5),
  s("squat", "lower_back", 4), s("squat", "hamstrings", 2), s("squat", "abs", 2),
  s("squat", "calves", 1),
  // Front Squat
  s("front_squat", "quads", 10), s("front_squat", "glutes", 6), s("front_squat", "abs", 5),
  s("front_squat", "lower_back", 4), s("front_squat", "adductors", 4), s("front_squat", "traps", 4),
  s("front_squat", "hamstrings", 2),
  // Goblet Squat
  s("goblet_squat", "quads", 9), s("goblet_squat", "glutes", 6), s("goblet_squat", "abs", 5),
  s("goblet_squat", "adductors", 4), s("goblet_squat", "forearms", 3), s("goblet_squat", "traps", 2),
  // Wide-Stance Squat — quads match the narrow squat (stance width doesn't
  // lower quad EMG); adductor advantage is EMG-mixed, so 7, not 8
  s("wide_stance_squat", "adductors", 7), s("wide_stance_squat", "quads", 9),
  s("wide_stance_squat", "glutes", 8), s("wide_stance_squat", "hamstrings", 3),
  s("wide_stance_squat", "lower_back", 4), s("wide_stance_squat", "abs", 2),
  // Bulgarian Split Squat
  s("bulgarian_split_squat", "quads", 10), s("bulgarian_split_squat", "glutes", 8),
  s("bulgarian_split_squat", "glute_med", 5), s("bulgarian_split_squat", "adductors", 4),
  s("bulgarian_split_squat", "hamstrings", 3), s("bulgarian_split_squat", "abs", 3),
  s("bulgarian_split_squat", "calves", 2),
  // Wall Sit — isometric knee extension, plank-of-the-quads
  s("wall_sit", "quads", 9), s("wall_sit", "glutes", 4), s("wall_sit", "adductors", 3),
  s("wall_sit", "calves", 2),
  // Squat Jump — every rep ends in a full-effort plantarflexion
  s("squat_jump", "quads", 9), s("squat_jump", "glutes", 7), s("squat_jump", "calves", 6),
  s("squat_jump", "hamstrings", 3), s("squat_jump", "abs", 2),
  // Burpee — full-body conditioning: squat + plank + push-up + jump
  s("burpee", "quads", 7), s("burpee", "glutes", 6), s("burpee", "mid_chest", 5),
  s("burpee", "abs", 4), s("burpee", "front_delts", 4), s("burpee", "triceps", 4),
  s("burpee", "hamstrings", 3), s("burpee", "calves", 3), s("burpee", "hip_flexors", 3),

  // Hinge scores follow the EMG literature: Martín-Fuentes 2020 systematic
  // review (deadlift: erectors + quads most active, hamstrings moderate);
  // McAllister 2014 (RDL top hamstring exercise, erectors ≈ good morning);
  // Contreras 2015 + Andersen 2018 (hip thrust ≥ deadlift > squat for glute
  // max; deadlift > hip thrust for hamstrings); Neto 2020 glute-EMG review
  // (loaded lifts "very high", bodyweight bridges/quadruped low-to-moderate —
  // why glute_bridge and donkey_kick sit at 7, not 9); Lehecka 2017
  // (single-leg bridge: hamstrings 75% / glute_med 58% / glute_max 51% MVIC).
  // Deadlift
  s("deadlift", "glutes", 10), s("deadlift", "hamstrings", 7), s("deadlift", "lower_back", 8),
  s("deadlift", "traps", 6), s("deadlift", "quads", 6), s("deadlift", "forearms", 5),
  s("deadlift", "lats", 4), s("deadlift", "abs", 3),
  // Romanian Deadlift
  s("romanian_deadlift", "hamstrings", 10), s("romanian_deadlift", "glutes", 8),
  s("romanian_deadlift", "lower_back", 7), s("romanian_deadlift", "forearms", 3),
  s("romanian_deadlift", "traps", 2),
  // Single-Leg RDL — unilateral hinge with a balance demand; hamstring work
  // sits below the bilateral RDL and Nordic (Bourne 2017 exercise-selection
  // EMG), glute med earns a 5 from single-leg pelvic control (McCurdy 2010)
  s("single_leg_rdl", "hamstrings", 8), s("single_leg_rdl", "glutes", 7),
  s("single_leg_rdl", "glute_med", 5), s("single_leg_rdl", "lower_back", 4),
  s("single_leg_rdl", "forearms", 2),
  // Good Morning
  s("good_morning", "hamstrings", 9), s("good_morning", "lower_back", 9),
  s("good_morning", "glutes", 7), s("good_morning", "abs", 3), s("good_morning", "traps", 2),
  // Back Extension
  s("back_extension", "lower_back", 10), s("back_extension", "glutes", 7),
  s("back_extension", "hamstrings", 6),
  // Hip Thrust — vastus lateralis EMG ≈ back squat (Contreras 2015), so
  // quads earn a real 4 here
  s("hip_thrust", "glutes", 10), s("hip_thrust", "hamstrings", 5), s("hip_thrust", "quads", 4),
  s("hip_thrust", "lower_back", 2),
  // Glute Bridge — bodyweight load ceiling keeps it well under the loaded
  // hip thrust (Neto 2020: bilateral bridges low-to-moderate glute EMG)
  s("glute_bridge", "glutes", 7), s("glute_bridge", "hamstrings", 5),
  s("glute_bridge", "abs", 3), s("glute_bridge", "quads", 2),
  // Single-Leg Glute Bridge — one leg doubles the load and adds pelvic
  // stability; hamstrings are actually the highest-EMG muscle (Lehecka 2017)
  s("single_leg_glute_bridge", "glutes", 8), s("single_leg_glute_bridge", "hamstrings", 6),
  s("single_leg_glute_bridge", "glute_med", 4), s("single_leg_glute_bridge", "lower_back", 2),
  s("single_leg_glute_bridge", "abs", 2),
  // Donkey Kick — quadruped hip extension, ~31-34% MVIC glute max: moderate,
  // nowhere near loaded hip extension
  s("donkey_kick", "glutes", 7), s("donkey_kick", "hamstrings", 4),
  s("donkey_kick", "glute_med", 3), s("donkey_kick", "lower_back", 2),
  // Superman — prone back extension with arms/legs lifted
  s("superman", "lower_back", 9), s("superman", "glutes", 6), s("superman", "hamstrings", 3),
  s("superman", "rear_delts", 3), s("superman", "traps", 2),

  // Lunge — glute med comparable to glute max in forward lunge (Muyor 2020)
  s("lunge", "quads", 9), s("lunge", "glutes", 8), s("lunge", "hamstrings", 4),
  s("lunge", "adductors", 3), s("lunge", "glute_med", 4), s("lunge", "calves", 2),
  s("lunge", "abs", 2),
  // Side Lunge — frontal-plane lunge; adductors of the straight leg do real work
  s("side_lunge", "adductors", 8), s("side_lunge", "quads", 7), s("side_lunge", "glutes", 6),
  s("side_lunge", "glute_med", 5), s("side_lunge", "hamstrings", 2),
  // Step-Up
  s("step_up", "quads", 9), s("step_up", "glutes", 8), s("step_up", "glute_med", 4),
  s("step_up", "hamstrings", 3), s("step_up", "hip_flexors", 3), s("step_up", "calves", 2),
  s("step_up", "abs", 2),

  // Push scores follow the EMG literature: Lauver 2016 + Rodríguez-Ridao
  // 2020 (bench-angle shifts are modest — flat bench trains the whole pec,
  // incline still hits ~87% of flat's sternal-pec EMG; upper pec peaks ~30°,
  // NOT higher than flat); Glass & Armstrong 1997 (decline > incline for
  // lower pec); Calatayud 2015 (push-up ≈ bench for prime movers at matched
  // load, plus serratus/core); McKenzie 2022 (bar dip > bench dip across pec,
  // delts, triceps, lats).
  // Bench Press
  s("bench_press", "mid_chest", 10), s("bench_press", "triceps", 7),
  s("bench_press", "front_delts", 6), s("bench_press", "lower_chest", 6),
  s("bench_press", "upper_chest", 4), s("bench_press", "rotator_cuff", 2),
  s("bench_press", "serratus", 2),
  // Incline Bench Press
  s("incline_bench_press", "upper_chest", 10), s("incline_bench_press", "front_delts", 7),
  s("incline_bench_press", "triceps", 6), s("incline_bench_press", "mid_chest", 6),
  s("incline_bench_press", "serratus", 2),
  // Decline Bench Press — the only primary driver of lower_chest
  s("decline_bench_press", "lower_chest", 10), s("decline_bench_press", "mid_chest", 6),
  s("decline_bench_press", "triceps", 6), s("decline_bench_press", "front_delts", 4),
  // Floor Press
  s("floor_press", "mid_chest", 9), s("floor_press", "triceps", 8),
  s("floor_press", "front_delts", 5), s("floor_press", "lower_chest", 3),
  // Push-Up
  s("push_up", "mid_chest", 9), s("push_up", "triceps", 7), s("push_up", "front_delts", 6),
  s("push_up", "serratus", 5), s("push_up", "abs", 4),
  // Scapular Push-Up (push-up plus) — the catalog's serratus flagship: the
  // protraction "plus" is the canonical serratus exercise (Ludewig 2004,
  // Ekstrom 2003); arms stay near-locked, so pec/triceps are stabilizers
  s("scapular_push_up", "serratus", 10), s("scapular_push_up", "mid_chest", 3),
  s("scapular_push_up", "triceps", 3), s("scapular_push_up", "abs", 3),
  // Chest Fly
  s("chest_fly", "mid_chest", 10), s("chest_fly", "upper_chest", 3),
  s("chest_fly", "lower_chest", 3), s("chest_fly", "front_delts", 3),
  s("chest_fly", "biceps", 2),

  // Shoulder Press (absorbed the old duplicate Overhead Press) — medial delt
  // runs close behind anterior in OHP (Saeterbakken & Fimland 2013), though
  // still clearly below lateral raise (Botton 2020)
  s("shoulder_press", "front_delts", 10), s("shoulder_press", "triceps", 7),
  s("shoulder_press", "side_delts", 7), s("shoulder_press", "serratus", 3),
  s("shoulder_press", "rotator_cuff", 3), s("shoulder_press", "upper_chest", 3),
  s("shoulder_press", "abs", 3), s("shoulder_press", "traps", 2),
  // Dip — bar dips also recruit lats meaningfully (McKenzie 2022)
  s("dip", "triceps", 10), s("dip", "lower_chest", 8), s("dip", "front_delts", 5),
  s("dip", "serratus", 3), s("dip", "lats", 2),
  // Bench Dip
  s("bench_dip", "triceps", 9), s("bench_dip", "lower_chest", 5), s("bench_dip", "front_delts", 4),

  // Pull scores follow the EMG literature: Fenwick/McGill 2009 (bent-over
  // row = highest erector demand of the rows; inverted row = highest lat +
  // hip-extensor EMG at the lowest lumbar load; 1-arm row = torsional trunk
  // demand); ACE/Edelburg 2018 (chest support removes lower-back work but
  // does NOT boost rhomboid EMG — rows are equivalent for mid-trap); Cools
  // 2007 (face-pull pattern maximizes lower/mid trap + infraspinatus); Jeong
  // 2022 (pull-apart trap EMG ~53-56% MVIC); Youdas 2010 (chin-up > pull-up
  // for biceps and pec, pull-up > chin-up for lower trap, lats equal-ish,
  // infraspinatus 71-79% MVIC in both).
  // Bent Over Row
  s("bent_over_row", "lats", 9), s("bent_over_row", "rhomboids", 8),
  s("bent_over_row", "traps", 6), s("bent_over_row", "rear_delts", 6),
  s("bent_over_row", "biceps", 5), s("bent_over_row", "lower_back", 5),
  s("bent_over_row", "forearms", 3),
  // Single-Arm Row — obliques earn a real score here from anti-rotation
  s("single_arm_row", "lats", 9), s("single_arm_row", "rhomboids", 7),
  s("single_arm_row", "traps", 5), s("single_arm_row", "rear_delts", 5),
  s("single_arm_row", "biceps", 5), s("single_arm_row", "forearms", 4),
  s("single_arm_row", "obliques", 4),
  // Chest-Supported Row — same pull as bent-over with the lower back removed
  // (support spares the spine, it doesn't add rhomboid EMG); co-primary
  // lats/rhomboids and still the catalog's rhomboid flagship
  s("chest_supported_row", "rhomboids", 9), s("chest_supported_row", "lats", 9),
  s("chest_supported_row", "traps", 7), s("chest_supported_row", "rear_delts", 6),
  s("chest_supported_row", "biceps", 5), s("chest_supported_row", "forearms", 3),
  // Inverted Row — horizontal bodyweight pull, body held as a rigid plank;
  // glutes hold the hip bridge (Fenwick 2009: highest hip-extensor EMG of
  // the rows)
  s("inverted_row", "lats", 9), s("inverted_row", "rhomboids", 8),
  s("inverted_row", "rear_delts", 6), s("inverted_row", "biceps", 6),
  s("inverted_row", "traps", 5), s("inverted_row", "forearms", 4),
  s("inverted_row", "abs", 3), s("inverted_row", "glutes", 2),
  // Face Pull
  s("face_pull", "rear_delts", 10), s("face_pull", "rotator_cuff", 7),
  s("face_pull", "traps", 6), s("face_pull", "rhomboids", 5),
  // Band Pull-Apart
  s("band_pull_apart", "rear_delts", 9), s("band_pull_apart", "rhomboids", 7),
  s("band_pull_apart", "traps", 6), s("band_pull_apart", "rotator_cuff", 5),
  // Prone Y-T-W — lower-trap/rear-delt raise family; among Cools 2007's
  // preferred low-upper-trap scapular exercises (Ekstrom 2003: prone Y ≈ top
  // lower-trap EMG)
  s("prone_ytw", "traps", 8), s("prone_ytw", "rear_delts", 7),
  s("prone_ytw", "rotator_cuff", 5), s("prone_ytw", "rhomboids", 5),

  // Pull-Up — infraspinatus works hard in both grips (Youdas 2010)
  s("pull_up", "lats", 10), s("pull_up", "biceps", 7), s("pull_up", "rhomboids", 5),
  s("pull_up", "forearms", 5), s("pull_up", "traps", 4), s("pull_up", "rotator_cuff", 4),
  s("pull_up", "abs", 3), s("pull_up", "rear_delts", 3),
  // Chin-Up — same pattern, meaningfully more bicep and a little pec
  s("chin_up", "lats", 9), s("chin_up", "biceps", 9), s("chin_up", "rhomboids", 5),
  s("chin_up", "forearms", 5), s("chin_up", "rotator_cuff", 4), s("chin_up", "traps", 3),
  s("chin_up", "abs", 3), s("chin_up", "mid_chest", 2),

  // Bicep Curl
  s("bicep_curl", "biceps", 10), s("bicep_curl", "forearms", 4),
  // Hammer Curl
  s("hammer_curl", "biceps", 8), s("hammer_curl", "forearms", 8),
  // Tricep Extension
  s("tricep_extension", "triceps", 10),
  // Lateral Raise — supraspinatus is a working co-abductor, not a mere
  // stabilizer (Reinold 2007); upper traps grow toward 90° (Coratella 2020)
  s("lateral_raise", "side_delts", 10), s("lateral_raise", "front_delts", 3),
  s("lateral_raise", "rotator_cuff", 4), s("lateral_raise", "traps", 3),
  // Shrug — the only primary driver of traps
  s("shrug", "traps", 10), s("shrug", "forearms", 5), s("shrug", "rhomboids", 3),
  // Calf Raise — the only primary driver of calves. No hamstring row: knee
  // angle changes gastrocnemius length, not hamstring drive (Signorile 2002)
  s("calf_raise", "calves", 10),
  // External Rotation — the only primary driver of rotator_cuff
  s("external_rotation", "rotator_cuff", 10), s("external_rotation", "rear_delts", 4),
  // Internal Rotation — subscapularis counterpart to ER, but band IR gets
  // heavy pec/lat assistance and Decker 2003 found push-up plus beats it for
  // subscapularis — hence 6, well under ER's 10
  s("band_internal_rotation", "rotator_cuff", 6), s("band_internal_rotation", "mid_chest", 2),
  // Scaption Raise (full-can) — supraspinatus works as hard as in empty-can
  // with less deltoid compensation and no impingement position (Reinold 2007)
  s("scaption_raise", "side_delts", 7), s("scaption_raise", "rotator_cuff", 7),
  s("scaption_raise", "front_delts", 5), s("scaption_raise", "traps", 4),
  // Terminal Knee Extension — low-load banded quad drill (generic quad work;
  // the old "targets the VMO" story is debunked — Smith 2009 EMG review);
  // band load ceiling keeps it under wall sit and far under loaded squats
  s("band_tke", "quads", 7),
  // Nordic Curl — eccentric knee flexion, hamstring-strain-prevention star
  // (Petersen 2011, van der Horst 2015 RCTs; van Dyk 2019 meta ~50% injury
  // reduction); ties the RDL's hamstring ceiling from the eccentric side
  s("nordic_curl", "hamstrings", 10), s("nordic_curl", "glutes", 3),
  s("nordic_curl", "calves", 3), s("nordic_curl", "lower_back", 2),
  // Tibialis Raise — the only driver of tibialis (ankle dorsiflexion; shin
  // health work is mostly clinical consensus, flagged in the PT doc)
  s("tibialis_raise", "tibialis", 10),

  // Carry scores follow McGill/Fenwick 2009 (maximal grip + oblique/QL
  // lateral-spine stiffness, spine near neutral), Winwood 2014 (pickup and
  // propulsion resemble a deadlift — hence the glute row), Stastny 2015
  // (glute med resists pelvic drop each step). Dead-hang EMG is finger-flexor
  // dominated; the lat is mostly on passive stretch.
  // Farmer Carry — the only primary driver of forearms alongside Bar Hang
  s("farmer_carry", "forearms", 10), s("farmer_carry", "traps", 7),
  s("farmer_carry", "abs", 5), s("farmer_carry", "obliques", 5),
  s("farmer_carry", "glute_med", 4), s("farmer_carry", "glutes", 3),
  s("farmer_carry", "calves", 3), s("farmer_carry", "lower_back", 3),
  // Farmer Carry (time) — same movement, clocked instead of measured
  s("timed_carry", "forearms", 10), s("timed_carry", "traps", 7),
  s("timed_carry", "abs", 5), s("timed_carry", "obliques", 5),
  s("timed_carry", "glute_med", 4), s("timed_carry", "glutes", 3),
  s("timed_carry", "calves", 3), s("timed_carry", "lower_back", 3),
  // Suitcase Carry — one-sided load turns the carry into anti-lateral
  // flexion: obliques/QL lead (McGill 2009/2013), grip stays below the
  // two-implement farmer carry
  s("suitcase_carry", "obliques", 9), s("suitcase_carry", "forearms", 8),
  s("suitcase_carry", "glute_med", 5), s("suitcase_carry", "abs", 4),
  s("suitcase_carry", "traps", 4), s("suitcase_carry", "lower_back", 3),
  // Bar Hang
  s("bar_hang", "forearms", 10), s("bar_hang", "lats", 3), s("bar_hang", "abs", 3),
  s("bar_hang", "traps", 3), s("bar_hang", "rotator_cuff", 3),

  // Core scores follow the EMG literature: Escamilla 2006 (hanging knee/leg
  // raises top-tier for rectus AND obliques); ACE/Francis 2001 (bicycle
  // crunch #1 of 13 for rectus, #2 for obliques); Serner 2014 (Copenhagen
  // adduction 108% nEMG adductor longus — catalog ceiling); Ekstrom 2007
  // (side bridge glute med 74% MVIC; bird dog = moderate multifidus + glute
  // max); Distefano 2009 (glute med: lateral band walk > clam). Pallof
  // press, mountain climber, woodchopper, jumping jacks have no published
  // exercise-specific EMG; those scores are clinical/coaching consensus.
  // Plank
  s("plank", "abs", 9), s("plank", "obliques", 5), s("plank", "serratus", 4),
  s("plank", "lower_back", 3), s("plank", "front_delts", 2),
  // Side Plank — glute med at 74% MVIC is a genuine strong secondary
  s("side_plank", "obliques", 10), s("side_plank", "abs", 6),
  s("side_plank", "glute_med", 7), s("side_plank", "side_delts", 3),
  // Copenhagen Plank — the only primary driver of adductors
  s("copenhagen_plank", "adductors", 10), s("copenhagen_plank", "obliques", 6),
  s("copenhagen_plank", "abs", 5), s("copenhagen_plank", "glute_med", 3),
  // Pallof Press
  s("pallof_press", "obliques", 10), s("pallof_press", "abs", 7),
  s("pallof_press", "front_delts", 3), s("pallof_press", "glute_med", 2),
  // Hanging Knee Raise — the concentric is hip flexion (iliopsoas, rectus
  // femoris) AND lumbar flexion / posterior pelvic tilt (rectus abdominis);
  // bent knees shorten the lever, so hip flexors sit a step below the
  // straight-leg raise.
  s("hanging_knee_raise", "abs", 10), s("hanging_knee_raise", "hip_flexors", 9),
  s("hanging_knee_raise", "obliques", 6), s("hanging_knee_raise", "forearms", 3),
  // Lateral Walk — the 10 assumes the band at the ankles/feet; at the knees
  // the stimulus drops sharply (Cambridge 2012)
  s("lateral_walk", "glute_med", 10), s("lateral_walk", "glutes", 4),
  s("lateral_walk", "quads", 3),
  // Banded Clam Shell — hip external rotation against the band. Basic clam
  // EMG is modest (~40% MVIC, Distefano 2009; banded/progressed higher,
  // Boren 2011); its real virtue is the best glute:TFL specificity of the
  // glute-med drills (Selkowitz 2013) — hence 7, not the old 9
  s("clam_shell", "glute_med", 7), s("clam_shell", "glutes", 5),
  // Fire Hydrant — quadruped hip abduction
  s("fire_hydrant", "glute_med", 9), s("fire_hydrant", "glutes", 4),
  // Side-Lying Hip Abduction — Distefano 2009's top glute med exercise
  // (81% MVIC, above lateral band walk); deliberately ties lateral_walk's 10
  s("side_lying_hip_abduction", "glute_med", 10), s("side_lying_hip_abduction", "glutes", 4),
  s("side_lying_hip_abduction", "obliques", 2),
  // Hanging Leg Raise — straight legs push both prime movers past knee raises
  s("hanging_leg_raise", "abs", 10), s("hanging_leg_raise", "hip_flexors", 10),
  s("hanging_leg_raise", "obliques", 6), s("hanging_leg_raise", "forearms", 4),
  s("hanging_leg_raise", "lats", 2),
  // Dead Bug — anti-extension with limb movement
  s("dead_bug", "abs", 8), s("dead_bug", "hip_flexors", 4), s("dead_bug", "obliques", 3),
  // Bird Dog (formerly "reverse_dead_bug") — quadruped opposite arm/leg
  // extension, Dead Bug's anti-flexion counterpart
  s("bird_dog", "lower_back", 7), s("bird_dog", "glutes", 5),
  s("bird_dog", "abs", 4), s("bird_dog", "glute_med", 3),
  // Sit-Up
  s("sit_up", "abs", 9), s("sit_up", "hip_flexors", 6), s("sit_up", "obliques", 3),
  // McGill Curl-Up — deliberately sub-maximal, spine-sparing (McGill Big 3);
  // scores stay well below sit-up/bicycle by design, not by oversight
  s("mcgill_curl_up", "abs", 6), s("mcgill_curl_up", "obliques", 2),
  // Hollow Hold
  s("hollow_hold", "abs", 10), s("hollow_hold", "hip_flexors", 5), s("hollow_hold", "quads", 2),
  // Russian Twist
  s("russian_twist", "obliques", 9), s("russian_twist", "abs", 6),
  s("russian_twist", "hip_flexors", 3),
  // Bicycle Crunch — ACE 2001: #1 of 13 ab exercises for rectus abdominis
  s("bicycle_crunch", "abs", 9), s("bicycle_crunch", "obliques", 8),
  s("bicycle_crunch", "hip_flexors", 4),
  // Mountain Climber — hip-flexor-led, shoulders hold a moving plank
  s("mountain_climber", "hip_flexors", 8), s("mountain_climber", "abs", 6),
  s("mountain_climber", "obliques", 4), s("mountain_climber", "front_delts", 3),
  s("mountain_climber", "serratus", 3),
  // Band Woodchopper — rotational pull across the body
  s("woodchopper", "obliques", 9), s("woodchopper", "abs", 5),
  s("woodchopper", "front_delts", 3), s("woodchopper", "glute_med", 2),
  // Jumping Jacks — light everywhere, nothing primary
  s("jumping_jacks", "calves", 5), s("jumping_jacks", "glute_med", 4),
  s("jumping_jacks", "side_delts", 4), s("jumping_jacks", "quads", 3),
  s("jumping_jacks", "hip_flexors", 3), s("jumping_jacks", "abs", 2),
  // Bear Crawl — a moving plank with knee drive
  s("bear_crawl", "abs", 6), s("bear_crawl", "front_delts", 6), s("bear_crawl", "quads", 5),
  s("bear_crawl", "hip_flexors", 5), s("bear_crawl", "serratus", 4),
  s("bear_crawl", "obliques", 4), s("bear_crawl", "triceps", 3),

  // Mobility (stretch/*_stretch/poses): intentionally none — the whole
  // pattern is excluded from volume math; see `pattern: 'mobility'`.
];

/**
 * Which modalities each exercise supports, and what you need to own to do it.
 *
 * `pull_up` / `chin_up` / `dip` × band are assistance-only: a loop band over
 * the pull-up bar takes weight off rather than adding it. That needs no extra
 * exercise rows, which is the whole point of modelling modality as a dimension.
 */
export const exerciseModalities: readonly ExerciseModality[] = [
  // ---- squat ----
  em("squat", "barbell", { isDefault: true, requiredEquipment: ["ohio_bar", "plates", "rack"], pinRisk: true }),
  em("squat", "bodyweight", { requiredEquipment: ["floor"] }),
  em("front_squat", "barbell", { isDefault: true, requiredEquipment: ["ohio_bar", "plates", "rack"], pinRisk: true }),
  em("goblet_squat", "dumbbell", { isDefault: true, requiredEquipment: ["dumbbells"] }),
  em("wide_stance_squat", "barbell", { isDefault: true, requiredEquipment: ["ohio_bar", "plates", "rack"], pinRisk: true }),
  em("wide_stance_squat", "bodyweight", { requiredEquipment: ["floor"] }),
  em("bulgarian_split_squat", "dumbbell", { isDefault: true, defaultUnilateralMode: "single_side", requiredEquipment: ["dumbbells", "bench"] }),
  em("bulgarian_split_squat", "bodyweight", { defaultUnilateralMode: "single_side", requiredEquipment: ["bench"] }),
  em("bulgarian_split_squat", "barbell", { defaultUnilateralMode: "single_side", requiredEquipment: ["ohio_bar", "plates", "rack", "bench"] }),
  em("wall_sit", "bodyweight", { isDefault: true, requiredEquipment: ["floor"] }),
  em("squat_jump", "bodyweight", { isDefault: true, requiredEquipment: ["floor"] }),
  em("burpee", "bodyweight", { isDefault: true, requiredEquipment: ["floor"] }),

  // ---- hinge ----
  em("deadlift", "barbell", { isDefault: true, requiredEquipment: ["ohio_bar", "plates"] }),
  em("deadlift", "dumbbell", { requiredEquipment: ["dumbbells"] }),
  em("romanian_deadlift", "barbell", { isDefault: true, requiredEquipment: ["ohio_bar", "plates"] }),
  em("romanian_deadlift", "dumbbell", { requiredEquipment: ["dumbbells"] }),
  em("single_leg_rdl", "dumbbell", { isDefault: true, defaultUnilateralMode: "single_side", requiredEquipment: ["dumbbells"] }),
  em("single_leg_rdl", "bodyweight", { defaultUnilateralMode: "single_side", requiredEquipment: ["floor"] }),
  em("good_morning", "barbell", { isDefault: true, requiredEquipment: ["ohio_bar", "plates", "rack"], pinRisk: true }),
  em("back_extension", "bodyweight", { isDefault: true, requiredEquipment: ["floor"] }),
  em("hip_thrust", "barbell", { isDefault: true, requiredEquipment: ["ohio_bar", "plates", "bench"] }),
  em("hip_thrust", "band", { bandRoles: ["resistance"], requiredEquipment: ["hip_bands", "bench"] }),
  em("glute_bridge", "bodyweight", { isDefault: true, requiredEquipment: ["floor"] }),
  em("glute_bridge", "band", { bandRoles: ["resistance"], requiredEquipment: ["hip_bands", "floor"] }),
  em("single_leg_glute_bridge", "bodyweight", { isDefault: true, defaultUnilateralMode: "single_side", requiredEquipment: ["floor"] }),
  em("donkey_kick", "bodyweight", { isDefault: true, defaultUnilateralMode: "single_side", requiredEquipment: ["floor"] }),
  em("donkey_kick", "band", { bandRoles: ["resistance"], defaultUnilateralMode: "single_side", requiredEquipment: ["hip_bands", "floor"], notes: "Hip band looped above the knees or under the standing knee." }),
  em("superman", "bodyweight", { isDefault: true, requiredEquipment: ["floor"] }),

  // ---- lunge ----
  em("lunge", "dumbbell", { isDefault: true, defaultUnilateralMode: "alternating", requiredEquipment: ["dumbbells"] }),
  em("lunge", "bodyweight", { defaultUnilateralMode: "alternating", requiredEquipment: ["floor"] }),
  em("lunge", "barbell", { defaultUnilateralMode: "alternating", requiredEquipment: ["ohio_bar", "plates", "rack"] }),
  em("side_lunge", "bodyweight", { isDefault: true, defaultUnilateralMode: "alternating", requiredEquipment: ["floor"] }),
  em("side_lunge", "dumbbell", { defaultUnilateralMode: "alternating", requiredEquipment: ["dumbbells"] }),
  em("step_up", "dumbbell", { isDefault: true, defaultUnilateralMode: "single_side", requiredEquipment: ["dumbbells", "bench"] }),
  em("step_up", "bodyweight", { defaultUnilateralMode: "single_side", requiredEquipment: ["bench"] }),

  // ---- horizontal push ----
  em("bench_press", "barbell", { isDefault: true, requiredEquipment: ["ohio_bar", "plates", "rack", "bench"], pinRisk: true }),
  em("bench_press", "dumbbell", { requiredEquipment: ["dumbbells", "bench"] }),
  em("incline_bench_press", "barbell", { isDefault: true, requiredEquipment: ["ohio_bar", "plates", "rack", "bench_incline"], pinRisk: true }),
  em("incline_bench_press", "dumbbell", { requiredEquipment: ["dumbbells", "bench_incline"] }),
  em("decline_bench_press", "barbell", { isDefault: true, requiredEquipment: ["ohio_bar", "plates", "rack", "bench_decline"], pinRisk: true }),
  em("decline_bench_press", "dumbbell", { requiredEquipment: ["dumbbells", "bench_decline"] }),
  // Floor press has no pin risk — that is the point of it.
  em("floor_press", "dumbbell", { isDefault: true, requiredEquipment: ["dumbbells", "floor"] }),
  em("floor_press", "barbell", { requiredEquipment: ["ohio_bar", "plates", "floor"] }),
  em("push_up", "bodyweight", { isDefault: true, requiredEquipment: ["floor"] }),
  em("scapular_push_up", "bodyweight", { isDefault: true, requiredEquipment: ["floor"], notes: "Arms locked; protract and retract the shoulder blades only." }),
  em("chest_fly", "dumbbell", { isDefault: true, requiredEquipment: ["dumbbells", "bench"] }),
  em("chest_fly", "band", { bandRoles: ["resistance"], requiredEquipment: ["monster_bands", "rack"] }),

  // ---- vertical push ----
  em("shoulder_press", "barbell", { isDefault: true, requiredEquipment: ["ohio_bar", "plates", "rack"] }),
  em("shoulder_press", "dumbbell", { requiredEquipment: ["dumbbells"] }),
  em("dip", "bodyweight", { isDefault: true, requiredEquipment: ["dip_bars"] }),
  em("dip", "band", { bandRoles: ["assistance"], requiredEquipment: ["dip_bars", "monster_bands"], notes: "Band loops across the dip bars to unload bodyweight." }),
  em("bench_dip", "bodyweight", { isDefault: true, requiredEquipment: ["bench"] }),

  // ---- horizontal pull ----
  em("bent_over_row", "barbell", { isDefault: true, requiredEquipment: ["ohio_bar", "plates"] }),
  em("bent_over_row", "dumbbell", { requiredEquipment: ["dumbbells"] }),
  em("single_arm_row", "dumbbell", { isDefault: true, defaultUnilateralMode: "single_side", requiredEquipment: ["dumbbells", "bench"] }),
  em("chest_supported_row", "dumbbell", { isDefault: true, requiredEquipment: ["dumbbells", "bench_incline"] }),
  em("inverted_row", "bodyweight", { isDefault: true, requiredEquipment: ["rack"], notes: "Bar racked ~hip height, body rigid. Elevate feet to progress." }),
  em("face_pull", "band", { isDefault: true, bandRoles: ["resistance"], requiredEquipment: ["monster_bands", "rack"] }),
  em("band_pull_apart", "band", { isDefault: true, bandRoles: ["resistance"], requiredEquipment: ["monster_bands"], notes: "No anchor needed — you hold both ends." }),
  em("prone_ytw", "bodyweight", { isDefault: true, requiredEquipment: ["floor"], notes: "Face down; slow reps of each letter shape." }),
  em("prone_ytw", "dumbbell", { requiredEquipment: ["dumbbells", "bench_incline"], notes: "Chest on a low incline, very light dumbbells." }),

  // ---- vertical pull ----
  em("pull_up", "bodyweight", { isDefault: true, requiredEquipment: ["pull_up_bar"] }),
  // Probably the highest-value variant in the library: with three beginners and
  // no pulldown machine, the four loop bands are a de facto assistance stack
  // from "can't do one" to unassisted.
  em("pull_up", "band", { bandRoles: ["assistance"], requiredEquipment: ["pull_up_bar", "monster_bands"], notes: "Band over the bar, foot or knee in the loop. Ascending tension helps most at the bottom, where you are weakest." }),
  em("pull_up", "dumbbell", { requiredEquipment: ["pull_up_bar", "dumbbells"], notes: "Weighted: dumbbell held between the feet." }),
  em("chin_up", "bodyweight", { isDefault: true, requiredEquipment: ["pull_up_bar"] }),
  em("chin_up", "band", { bandRoles: ["assistance"], requiredEquipment: ["pull_up_bar", "monster_bands"] }),

  // ---- isolation ----
  em("bicep_curl", "dumbbell", { isDefault: true, requiredEquipment: ["dumbbells"] }),
  em("bicep_curl", "barbell", { requiredEquipment: ["ohio_bar", "plates"] }),
  em("bicep_curl", "band", { bandRoles: ["resistance"], requiredEquipment: ["monster_bands"] }),
  em("hammer_curl", "dumbbell", { isDefault: true, requiredEquipment: ["dumbbells"] }),
  em("tricep_extension", "dumbbell", { isDefault: true, requiredEquipment: ["dumbbells"] }),
  em("tricep_extension", "band", { bandRoles: ["resistance"], requiredEquipment: ["monster_bands", "rack"] }),
  em("lateral_raise", "dumbbell", { isDefault: true, requiredEquipment: ["dumbbells"] }),
  em("lateral_raise", "band", { bandRoles: ["resistance"], requiredEquipment: ["monster_bands"] }),
  em("shrug", "barbell", { isDefault: true, requiredEquipment: ["ohio_bar", "plates"] }),
  em("shrug", "dumbbell", { requiredEquipment: ["dumbbells"] }),
  em("calf_raise", "dumbbell", { isDefault: true, requiredEquipment: ["dumbbells"] }),
  em("calf_raise", "barbell", { requiredEquipment: ["ohio_bar", "plates", "rack"] }),
  em("calf_raise", "bodyweight", { requiredEquipment: ["floor"] }),
  em("external_rotation", "band", { isDefault: true, bandRoles: ["resistance"], defaultUnilateralMode: "single_side", requiredEquipment: ["monster_bands", "rack"] }),
  em("external_rotation", "dumbbell", { defaultUnilateralMode: "single_side", requiredEquipment: ["dumbbells", "bench"] }),
  em("band_internal_rotation", "band", { isDefault: true, bandRoles: ["resistance"], defaultUnilateralMode: "single_side", requiredEquipment: ["monster_bands", "rack"], notes: "Elbow pinned to the ribs; rotate the forearm across the body." }),
  em("scaption_raise", "dumbbell", { isDefault: true, requiredEquipment: ["dumbbells"], notes: "Light. Thumbs up, 30° forward of sideways, stop at shoulder height." }),
  em("band_tke", "band", { isDefault: true, bandRoles: ["resistance"], defaultUnilateralMode: "single_side", requiredEquipment: ["monster_bands", "rack"], notes: "Band behind the knee, anchored ahead; lock the knee out against it." }),
  em("nordic_curl", "bodyweight", { isDefault: true, requiredEquipment: ["floor", "ohio_bar", "plates"], notes: "Heels anchored under a loaded bar. Eccentric-only: lower slow, push back up with hands." }),
  em("tibialis_raise", "bodyweight", { isDefault: true, requiredEquipment: ["floor"], notes: "Lean back on a wall, heels forward; lift the toes." }),
  em("tibialis_raise", "band", { bandRoles: ["resistance"], defaultUnilateralMode: "single_side", requiredEquipment: ["monster_bands", "rack"] }),

  // ---- carry / hang ----
  em("farmer_carry", "dumbbell", { isDefault: true, requiredEquipment: ["dumbbells"] }),
  em("timed_carry", "dumbbell", { isDefault: true, requiredEquipment: ["dumbbells"] }),
  em("suitcase_carry", "dumbbell", { isDefault: true, defaultUnilateralMode: "single_side", requiredEquipment: ["dumbbells"], notes: "One dumbbell; stay tall, don't lean away." }),
  em("bar_hang", "bodyweight", { isDefault: true, requiredEquipment: ["pull_up_bar"] }),

  // ---- core ----
  em("plank", "bodyweight", { isDefault: true, requiredEquipment: ["floor"] }),
  em("side_plank", "bodyweight", { isDefault: true, defaultUnilateralMode: "single_side", requiredEquipment: ["floor"] }),
  em("copenhagen_plank", "bodyweight", { isDefault: true, defaultUnilateralMode: "single_side", requiredEquipment: ["floor", "bench"] }),
  em("pallof_press", "band", { isDefault: true, bandRoles: ["resistance"], defaultUnilateralMode: "single_side", requiredEquipment: ["monster_bands", "rack"] }),
  em("hanging_knee_raise", "bodyweight", { isDefault: true, requiredEquipment: ["pull_up_bar"] }),
  // Hip-band only. Fire Hydrant's bodyweight default also drives glute_med as
  // primary, so glute_med volume is no longer ordinal-only across the library.
  em("lateral_walk", "band", { isDefault: true, bandRoles: ["resistance"], requiredEquipment: ["hip_bands"], notes: "Band at the ankles for the strongest glute-med stimulus (knees = easier)." }),
  em("clam_shell", "band", { isDefault: true, bandRoles: ["resistance"], defaultUnilateralMode: "single_side", requiredEquipment: ["hip_bands", "floor"] }),
  em("side_lying_hip_abduction", "bodyweight", { isDefault: true, defaultUnilateralMode: "single_side", requiredEquipment: ["floor"], notes: "Top leg straight, toes forward; lift from the hip, not the waist." }),
  em("side_lying_hip_abduction", "band", { bandRoles: ["resistance"], defaultUnilateralMode: "single_side", requiredEquipment: ["hip_bands", "floor"] }),
  em("fire_hydrant", "bodyweight", { isDefault: true, defaultUnilateralMode: "single_side", requiredEquipment: ["floor"] }),
  em("fire_hydrant", "band", { bandRoles: ["resistance"], defaultUnilateralMode: "single_side", requiredEquipment: ["hip_bands", "floor"] }),
  em("hanging_leg_raise", "bodyweight", { isDefault: true, requiredEquipment: ["pull_up_bar"] }),
  em("dead_bug", "bodyweight", { isDefault: true, requiredEquipment: ["floor"] }),
  em("bird_dog", "bodyweight", { isDefault: true, defaultUnilateralMode: "alternating", requiredEquipment: ["floor"] }),
  em("sit_up", "bodyweight", { isDefault: true, requiredEquipment: ["floor"] }),
  em("mcgill_curl_up", "bodyweight", { isDefault: true, requiredEquipment: ["floor"], notes: "Hands under the low back, one knee bent; lift head+shoulders a few inches, ~10s braced hold." }),
  em("sit_up", "dumbbell", { requiredEquipment: ["dumbbells", "floor"], notes: "Weighted: dumbbell hugged to the chest." }),
  em("hollow_hold", "bodyweight", { isDefault: true, requiredEquipment: ["floor"] }),
  em("russian_twist", "bodyweight", { isDefault: true, requiredEquipment: ["floor"] }),
  em("russian_twist", "dumbbell", { requiredEquipment: ["dumbbells", "floor"] }),
  em("bicycle_crunch", "bodyweight", { isDefault: true, requiredEquipment: ["floor"] }),
  em("mountain_climber", "bodyweight", { isDefault: true, requiredEquipment: ["floor"] }),
  em("woodchopper", "band", { isDefault: true, bandRoles: ["resistance"], defaultUnilateralMode: "single_side", requiredEquipment: ["monster_bands", "rack"] }),
  em("jumping_jacks", "bodyweight", { isDefault: true, requiredEquipment: ["floor"] }),
  em("bear_crawl", "bodyweight", { isDefault: true, requiredEquipment: ["floor"] }),

  // ---- mobility ----
  em("stretch", "bodyweight", { isDefault: true, requiredEquipment: ["floor"] }),
  em("wall_slide", "bodyweight", { isDefault: true, requiredEquipment: ["floor"], notes: "Back and forearms on the wall; slide overhead without arching." }),
  em("knee_to_wall", "bodyweight", { isDefault: true, defaultUnilateralMode: "single_side", requiredEquipment: ["floor"], notes: "Knee drives over the toes to the wall; heel stays down." }),
  em("standing_hamstring_stretch", "bodyweight", { isDefault: true, defaultUnilateralMode: "single_side", requiredEquipment: ["floor"] }),
  em("standing_quad_stretch", "bodyweight", { isDefault: true, defaultUnilateralMode: "single_side", requiredEquipment: ["floor"] }),
  em("calf_stretch", "bodyweight", { isDefault: true, defaultUnilateralMode: "single_side", requiredEquipment: ["floor"] }),
  em("butterfly_stretch", "bodyweight", { isDefault: true, requiredEquipment: ["floor"] }),
  em("figure_four_stretch", "bodyweight", { isDefault: true, defaultUnilateralMode: "single_side", requiredEquipment: ["floor"] }),
  em("pigeon_pose", "bodyweight", { isDefault: true, defaultUnilateralMode: "single_side", requiredEquipment: ["floor"] }),
  em("ninety_ninety_stretch", "bodyweight", { isDefault: true, defaultUnilateralMode: "single_side", requiredEquipment: ["floor"] }),
  em("kneeling_hip_flexor_stretch", "bodyweight", { isDefault: true, defaultUnilateralMode: "single_side", requiredEquipment: ["floor"] }),
  em("worlds_greatest_stretch", "bodyweight", { isDefault: true, defaultUnilateralMode: "single_side", requiredEquipment: ["floor"] }),
  em("childs_pose", "bodyweight", { isDefault: true, requiredEquipment: ["floor"] }),
  em("cat_cow", "bodyweight", { isDefault: true, requiredEquipment: ["floor"] }),
  em("cobra_stretch", "bodyweight", { isDefault: true, requiredEquipment: ["floor"] }),
  em("thread_the_needle", "bodyweight", { isDefault: true, defaultUnilateralMode: "single_side", requiredEquipment: ["floor"] }),
  em("downward_dog", "bodyweight", { isDefault: true, requiredEquipment: ["floor"] }),
  em("doorway_chest_stretch", "bodyweight", { isDefault: true, requiredEquipment: ["floor"], notes: "Use the rack uprights if no doorway." }),
  em("cross_body_shoulder_stretch", "bodyweight", { isDefault: true, defaultUnilateralMode: "single_side", requiredEquipment: ["floor"] }),
  em("overhead_triceps_stretch", "bodyweight", { isDefault: true, defaultUnilateralMode: "single_side", requiredEquipment: ["floor"] }),
  em("standing_lat_stretch", "bodyweight", { isDefault: true, defaultUnilateralMode: "single_side", requiredEquipment: ["floor"] }),
  em("seated_forward_fold", "bodyweight", { isDefault: true, requiredEquipment: ["floor"] }),
  em("standing_forward_fold", "bodyweight", { isDefault: true, requiredEquipment: ["floor"] }),
  em("upward_dog", "bodyweight", { isDefault: true, requiredEquipment: ["floor"] }),
  em("supine_spinal_twist", "bodyweight", { isDefault: true, defaultUnilateralMode: "single_side", requiredEquipment: ["floor"] }),
  em("seated_spinal_twist", "bodyweight", { isDefault: true, defaultUnilateralMode: "single_side", requiredEquipment: ["floor"] }),
  em("happy_baby", "bodyweight", { isDefault: true, requiredEquipment: ["floor"] }),
  em("frog_pose", "bodyweight", { isDefault: true, requiredEquipment: ["floor"] }),
  em("lizard_pose", "bodyweight", { isDefault: true, defaultUnilateralMode: "single_side", requiredEquipment: ["floor"] }),
  em("triangle_pose", "bodyweight", { isDefault: true, defaultUnilateralMode: "single_side", requiredEquipment: ["floor"] }),
  em("pancake_stretch", "bodyweight", { isDefault: true, requiredEquipment: ["floor"] }),
];

// ---------------------------------------------------------------------------
// Row builders — keep the tables above readable without losing type checking
// ---------------------------------------------------------------------------

function s(
  exerciseId: ExerciseMuscleScore["exerciseId"],
  muscleId: MuscleId,
  score: number,
): ExerciseMuscleScore {
  return { exerciseId, muscleId, score };
}

function em(
  exerciseId: ExerciseModality["exerciseId"],
  modalityId: ExerciseModality["modalityId"],
  overrides: Partial<Omit<ExerciseModality, "exerciseId" | "modalityId">> = {},
): ExerciseModality {
  return {
    exerciseId,
    modalityId,
    isDefault: false,
    bandRoles: [],
    defaultUnilateralMode: "bilateral",
    requiredEquipment: [],
    pinRisk: false,
    loadFactorOverride: null,
    notes: "",
    ...overrides,
  };
}

