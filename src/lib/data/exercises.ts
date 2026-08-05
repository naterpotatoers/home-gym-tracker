import type {
  Exercise,
  ExerciseModality,
  ExerciseMuscleScore,
  MuscleId,
} from "../types";

/**
 * Generic movements. No `muscleGroup` field — the primary muscle and group are
 * derived from `exerciseMuscleScores` so the two can never disagree. (The old
 * data already disagreed: Deadlift was tagged `back` while its scores said
 * glutes 10 / hamstrings 8 / lower_back 8, i.e. legs.)
 *
 * Overhead Press and Shoulder Press were the same movement with near-identical
 * score rows, which silently double-counted shoulder volume depending on which
 * one got logged. They are one `shoulder_press` here with barbell and dumbbell
 * modalities.
 */
export const exercises: readonly Exercise[] = [
  // ---- squat ----
  { id: "squat", name: "Squat", pattern: "squat", metricType: "reps", isCompound: true },
  { id: "front_squat", name: "Front Squat", pattern: "squat", metricType: "reps", isCompound: true },
  { id: "goblet_squat", name: "Goblet Squat", pattern: "squat", metricType: "reps", isCompound: true },
  { id: "wide_stance_squat", name: "Wide-Stance Squat", pattern: "squat", metricType: "reps", isCompound: true },
  { id: "bulgarian_split_squat", name: "Bulgarian Split Squat", pattern: "squat", metricType: "reps", isCompound: true },
  { id: "wall_sit", name: "Wall Sit", pattern: "squat", metricType: "time", isCompound: false },
  { id: "squat_jump", name: "Squat Jump", pattern: "squat", metricType: "reps", isCompound: true },
  { id: "burpee", name: "Burpee", pattern: "squat", metricType: "reps", isCompound: true },

  // ---- hinge ----
  { id: "deadlift", name: "Deadlift", pattern: "hinge", metricType: "reps", isCompound: true },
  { id: "romanian_deadlift", name: "Romanian Deadlift", pattern: "hinge", metricType: "reps", isCompound: true },
  { id: "good_morning", name: "Good Morning", pattern: "hinge", metricType: "reps", isCompound: true },
  { id: "back_extension", name: "Back Extension", pattern: "hinge", metricType: "reps", isCompound: false },
  { id: "hip_thrust", name: "Hip Thrust", pattern: "hinge", metricType: "reps", isCompound: true },
  { id: "glute_bridge", name: "Glute Bridge", pattern: "hinge", metricType: "reps", isCompound: false },
  { id: "single_leg_glute_bridge", name: "Single-Leg Glute Bridge", pattern: "hinge", metricType: "reps", isCompound: false },
  { id: "donkey_kick", name: "Donkey Kick", pattern: "hinge", metricType: "reps", isCompound: false },
  { id: "superman", name: "Superman", pattern: "hinge", metricType: "reps", isCompound: false },

  // ---- lunge ----
  { id: "lunge", name: "Lunge", pattern: "lunge", metricType: "reps", isCompound: true },
  { id: "side_lunge", name: "Side Lunge", pattern: "lunge", metricType: "reps", isCompound: true },
  { id: "step_up", name: "Step-Up", pattern: "lunge", metricType: "reps", isCompound: true },

  // ---- horizontal push ----
  { id: "bench_press", name: "Bench Press", pattern: "push_h", metricType: "reps", isCompound: true },
  { id: "incline_bench_press", name: "Incline Bench Press", pattern: "push_h", metricType: "reps", isCompound: true },
  { id: "decline_bench_press", name: "Decline Bench Press", pattern: "push_h", metricType: "reps", isCompound: true },
  { id: "floor_press", name: "Floor Press", pattern: "push_h", metricType: "reps", isCompound: true },
  { id: "push_up", name: "Push-Up", pattern: "push_h", metricType: "reps", isCompound: true },
  { id: "chest_fly", name: "Chest Fly", pattern: "push_h", metricType: "reps", isCompound: false },

  // ---- vertical push ----
  { id: "shoulder_press", name: "Shoulder Press", pattern: "push_v", metricType: "reps", isCompound: true },
  { id: "dip", name: "Dip", pattern: "push_v", metricType: "reps", isCompound: true },
  { id: "bench_dip", name: "Bench Dip", pattern: "push_v", metricType: "reps", isCompound: true },

  // ---- horizontal pull ----
  { id: "bent_over_row", name: "Bent Over Row", pattern: "pull_h", metricType: "reps", isCompound: true },
  { id: "single_arm_row", name: "Single-Arm Row", pattern: "pull_h", metricType: "reps", isCompound: true },
  { id: "chest_supported_row", name: "Chest-Supported Row", pattern: "pull_h", metricType: "reps", isCompound: true },
  { id: "face_pull", name: "Face Pull", pattern: "pull_h", metricType: "reps", isCompound: false },
  { id: "band_pull_apart", name: "Band Pull-Apart", pattern: "pull_h", metricType: "reps", isCompound: false },

  // ---- vertical pull ----
  { id: "pull_up", name: "Pull-Up", pattern: "pull_v", metricType: "reps", isCompound: true },
  { id: "chin_up", name: "Chin-Up", pattern: "pull_v", metricType: "reps", isCompound: true },

  // ---- isolation ----
  { id: "bicep_curl", name: "Bicep Curl", pattern: "isolation", metricType: "reps", isCompound: false },
  { id: "hammer_curl", name: "Hammer Curl", pattern: "isolation", metricType: "reps", isCompound: false },
  { id: "tricep_extension", name: "Tricep Extension", pattern: "isolation", metricType: "reps", isCompound: false },
  { id: "lateral_raise", name: "Lateral Raise", pattern: "isolation", metricType: "reps", isCompound: false },
  { id: "shrug", name: "Shrug", pattern: "isolation", metricType: "reps", isCompound: false },
  { id: "calf_raise", name: "Calf Raise", pattern: "isolation", metricType: "reps", isCompound: false },
  { id: "external_rotation", name: "External Rotation", pattern: "isolation", metricType: "reps", isCompound: false },

  // ---- carry / hang ----
  { id: "farmer_carry", name: "Farmer Carry", pattern: "carry", metricType: "distance", isCompound: true },
  { id: "timed_carry", name: "Farmer Carry (time)", pattern: "carry", metricType: "time", isCompound: true },
  { id: "bar_hang", name: "Bar Hang", pattern: "carry", metricType: "time", isCompound: false },

  // ---- core ----
  { id: "plank", name: "Plank", pattern: "core", metricType: "time", isCompound: false },
  { id: "side_plank", name: "Side Plank", pattern: "core", metricType: "time", isCompound: false },
  { id: "copenhagen_plank", name: "Copenhagen Plank", pattern: "core", metricType: "time", isCompound: false },
  { id: "pallof_press", name: "Pallof Press", pattern: "core", metricType: "reps", isCompound: false },
  { id: "hanging_knee_raise", name: "Hanging Knee Raise", pattern: "core", metricType: "reps", isCompound: false },
  { id: "hanging_leg_raise", name: "Hanging Leg Raise", pattern: "core", metricType: "reps", isCompound: false },
  { id: "lateral_walk", name: "Lateral Walk", pattern: "core", metricType: "reps", isCompound: false },
  { id: "clam_shell", name: "Banded Clam Shell", pattern: "core", metricType: "reps", isCompound: false },
  { id: "fire_hydrant", name: "Fire Hydrant", pattern: "core", metricType: "reps", isCompound: false },
  { id: "dead_bug", name: "Dead Bug", pattern: "core", metricType: "reps", isCompound: false },
  { id: "bird_dog", name: "Bird Dog", pattern: "core", metricType: "reps", isCompound: false },
  { id: "sit_up", name: "Sit-Up", pattern: "core", metricType: "reps", isCompound: false },
  { id: "hollow_hold", name: "Hollow Hold", pattern: "core", metricType: "time", isCompound: false },
  { id: "russian_twist", name: "Russian Twist", pattern: "core", metricType: "reps", isCompound: false },
  { id: "bicycle_crunch", name: "Bicycle Crunch", pattern: "core", metricType: "reps", isCompound: false },
  { id: "mountain_climber", name: "Mountain Climber", pattern: "core", metricType: "reps", isCompound: false },
  { id: "woodchopper", name: "Band Woodchopper", pattern: "core", metricType: "reps", isCompound: false },
  // Timed conditioning — counting jacks or measuring crawl distance in a
  // garage is impractical, so both are clocked.
  { id: "jumping_jacks", name: "Jumping Jacks", pattern: "core", metricType: "time", isCompound: true },
  { id: "bear_crawl", name: "Bear Crawl", pattern: "core", metricType: "time", isCompound: true },

  // ---- mobility ----
  // No muscle scores on purpose. `mobility` is excluded from all volume math
  // rather than silently contributing a zero.
  // Names carry the body part so picker search ("hamstring", "hip", "back")
  // finds them. All timed holds/flows; single_side ones log per side.
  { id: "stretch", name: "Stretch (general)", pattern: "mobility", metricType: "time", isCompound: false },
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
];

/**
 * Score scale: 10 = primary mover, 6-8 = strong secondary, 3-5 = supporting,
 * 1-2 = stabilizer. Authored per exercise; the modality adjusts these via
 * `muscleModifiers`, it does not re-author them.
 */
export const exerciseMuscleScores: readonly ExerciseMuscleScore[] = [
  // Squat
  s("squat", "quads", 10), s("squat", "glutes", 7), s("squat", "adductors", 5),
  s("squat", "lower_back", 4), s("squat", "hamstrings", 3), s("squat", "abs", 2),
  s("squat", "calves", 1),
  // Front Squat
  s("front_squat", "quads", 10), s("front_squat", "glutes", 6), s("front_squat", "abs", 5),
  s("front_squat", "lower_back", 4), s("front_squat", "adductors", 4), s("front_squat", "traps", 4),
  s("front_squat", "hamstrings", 2),
  // Goblet Squat
  s("goblet_squat", "quads", 9), s("goblet_squat", "glutes", 6), s("goblet_squat", "abs", 5),
  s("goblet_squat", "adductors", 4), s("goblet_squat", "forearms", 3), s("goblet_squat", "traps", 2),
  // Wide-Stance Squat
  s("wide_stance_squat", "adductors", 8), s("wide_stance_squat", "quads", 8),
  s("wide_stance_squat", "glutes", 8), s("wide_stance_squat", "hamstrings", 4),
  s("wide_stance_squat", "lower_back", 4), s("wide_stance_squat", "abs", 2),
  // Bulgarian Split Squat
  s("bulgarian_split_squat", "quads", 10), s("bulgarian_split_squat", "glutes", 8),
  s("bulgarian_split_squat", "glute_med", 4), s("bulgarian_split_squat", "adductors", 4),
  s("bulgarian_split_squat", "hamstrings", 3), s("bulgarian_split_squat", "abs", 3),
  s("bulgarian_split_squat", "calves", 2),
  // Wall Sit — isometric knee extension, plank-of-the-quads
  s("wall_sit", "quads", 9), s("wall_sit", "glutes", 4), s("wall_sit", "adductors", 3),
  s("wall_sit", "calves", 2),
  // Squat Jump
  s("squat_jump", "quads", 9), s("squat_jump", "glutes", 7), s("squat_jump", "calves", 5),
  s("squat_jump", "hamstrings", 3), s("squat_jump", "abs", 2),
  // Burpee — full-body conditioning: squat + plank + push-up + jump
  s("burpee", "quads", 7), s("burpee", "glutes", 6), s("burpee", "mid_chest", 5),
  s("burpee", "abs", 4), s("burpee", "front_delts", 4), s("burpee", "triceps", 4),
  s("burpee", "hamstrings", 3), s("burpee", "calves", 3), s("burpee", "hip_flexors", 3),

  // Deadlift
  s("deadlift", "glutes", 10), s("deadlift", "hamstrings", 8), s("deadlift", "lower_back", 8),
  s("deadlift", "traps", 6), s("deadlift", "quads", 5), s("deadlift", "forearms", 5),
  s("deadlift", "lats", 4), s("deadlift", "abs", 3),
  // Romanian Deadlift
  s("romanian_deadlift", "hamstrings", 10), s("romanian_deadlift", "glutes", 8),
  s("romanian_deadlift", "lower_back", 6), s("romanian_deadlift", "forearms", 3),
  s("romanian_deadlift", "traps", 2),
  // Good Morning
  s("good_morning", "hamstrings", 9), s("good_morning", "lower_back", 9),
  s("good_morning", "glutes", 7), s("good_morning", "abs", 3), s("good_morning", "traps", 2),
  // Back Extension
  s("back_extension", "lower_back", 10), s("back_extension", "glutes", 7),
  s("back_extension", "hamstrings", 6),
  // Hip Thrust
  s("hip_thrust", "glutes", 10), s("hip_thrust", "hamstrings", 5), s("hip_thrust", "quads", 3),
  s("hip_thrust", "lower_back", 2),
  // Glute Bridge
  s("glute_bridge", "glutes", 9), s("glute_bridge", "hamstrings", 5),
  s("glute_bridge", "abs", 3), s("glute_bridge", "quads", 2),
  // Single-Leg Glute Bridge — one leg doubles the load and adds pelvic stability
  s("single_leg_glute_bridge", "glutes", 9), s("single_leg_glute_bridge", "hamstrings", 6),
  s("single_leg_glute_bridge", "glute_med", 3), s("single_leg_glute_bridge", "lower_back", 2),
  s("single_leg_glute_bridge", "abs", 2),
  // Donkey Kick — quadruped hip extension
  s("donkey_kick", "glutes", 9), s("donkey_kick", "hamstrings", 4),
  s("donkey_kick", "glute_med", 3), s("donkey_kick", "lower_back", 2),
  // Superman — prone back extension with arms/legs lifted
  s("superman", "lower_back", 9), s("superman", "glutes", 6), s("superman", "hamstrings", 3),
  s("superman", "rear_delts", 3), s("superman", "traps", 2),

  // Lunge
  s("lunge", "quads", 9), s("lunge", "glutes", 8), s("lunge", "hamstrings", 4),
  s("lunge", "adductors", 3), s("lunge", "glute_med", 3), s("lunge", "calves", 2),
  s("lunge", "abs", 2),
  // Side Lunge — frontal-plane lunge; adductors of the straight leg do real work
  s("side_lunge", "adductors", 8), s("side_lunge", "quads", 7), s("side_lunge", "glutes", 6),
  s("side_lunge", "glute_med", 5), s("side_lunge", "hamstrings", 2),
  // Step-Up
  s("step_up", "quads", 9), s("step_up", "glutes", 8), s("step_up", "glute_med", 4),
  s("step_up", "hamstrings", 3), s("step_up", "hip_flexors", 3), s("step_up", "calves", 2),
  s("step_up", "abs", 2),

  // Bench Press
  s("bench_press", "mid_chest", 10), s("bench_press", "triceps", 7),
  s("bench_press", "front_delts", 6), s("bench_press", "lower_chest", 5),
  s("bench_press", "rotator_cuff", 2), s("bench_press", "serratus", 2),
  // Incline Bench Press
  s("incline_bench_press", "upper_chest", 10), s("incline_bench_press", "front_delts", 7),
  s("incline_bench_press", "triceps", 6), s("incline_bench_press", "mid_chest", 4),
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
  // Chest Fly
  s("chest_fly", "mid_chest", 10), s("chest_fly", "upper_chest", 3),
  s("chest_fly", "lower_chest", 3), s("chest_fly", "front_delts", 3),
  s("chest_fly", "biceps", 2),

  // Shoulder Press (absorbed the old duplicate Overhead Press)
  s("shoulder_press", "front_delts", 10), s("shoulder_press", "triceps", 7),
  s("shoulder_press", "side_delts", 6), s("shoulder_press", "serratus", 3),
  s("shoulder_press", "rotator_cuff", 3), s("shoulder_press", "upper_chest", 3),
  s("shoulder_press", "abs", 3), s("shoulder_press", "traps", 2),
  // Dip
  s("dip", "triceps", 10), s("dip", "lower_chest", 8), s("dip", "front_delts", 5),
  s("dip", "serratus", 3),
  // Bench Dip
  s("bench_dip", "triceps", 9), s("bench_dip", "lower_chest", 5), s("bench_dip", "front_delts", 4),

  // Bent Over Row
  s("bent_over_row", "lats", 9), s("bent_over_row", "rhomboids", 8),
  s("bent_over_row", "traps", 6), s("bent_over_row", "rear_delts", 6),
  s("bent_over_row", "biceps", 5), s("bent_over_row", "lower_back", 4),
  s("bent_over_row", "forearms", 3),
  // Single-Arm Row — obliques earn a real score here from anti-rotation
  s("single_arm_row", "lats", 9), s("single_arm_row", "rhomboids", 7),
  s("single_arm_row", "traps", 5), s("single_arm_row", "rear_delts", 5),
  s("single_arm_row", "biceps", 5), s("single_arm_row", "forearms", 4),
  s("single_arm_row", "obliques", 4),
  // Chest-Supported Row — the only primary driver of rhomboids
  s("chest_supported_row", "rhomboids", 10), s("chest_supported_row", "lats", 8),
  s("chest_supported_row", "traps", 7), s("chest_supported_row", "rear_delts", 6),
  s("chest_supported_row", "biceps", 5), s("chest_supported_row", "forearms", 3),
  // Face Pull
  s("face_pull", "rear_delts", 10), s("face_pull", "rotator_cuff", 7),
  s("face_pull", "traps", 6), s("face_pull", "rhomboids", 5),
  // Band Pull-Apart
  s("band_pull_apart", "rear_delts", 9), s("band_pull_apart", "rhomboids", 7),
  s("band_pull_apart", "traps", 5), s("band_pull_apart", "rotator_cuff", 5),

  // Pull-Up
  s("pull_up", "lats", 10), s("pull_up", "biceps", 7), s("pull_up", "rhomboids", 5),
  s("pull_up", "forearms", 5), s("pull_up", "traps", 4), s("pull_up", "abs", 3),
  s("pull_up", "rear_delts", 3),
  // Chin-Up — same pattern, meaningfully more bicep
  s("chin_up", "lats", 9), s("chin_up", "biceps", 9), s("chin_up", "rhomboids", 5),
  s("chin_up", "forearms", 5), s("chin_up", "traps", 3), s("chin_up", "abs", 3),

  // Bicep Curl
  s("bicep_curl", "biceps", 10), s("bicep_curl", "forearms", 4),
  // Hammer Curl
  s("hammer_curl", "biceps", 8), s("hammer_curl", "forearms", 8),
  // Tricep Extension
  s("tricep_extension", "triceps", 10),
  // Lateral Raise
  s("lateral_raise", "side_delts", 10), s("lateral_raise", "front_delts", 3),
  s("lateral_raise", "rotator_cuff", 2), s("lateral_raise", "traps", 2),
  // Shrug — the only primary driver of traps
  s("shrug", "traps", 10), s("shrug", "forearms", 5), s("shrug", "rhomboids", 3),
  // Calf Raise — the only primary driver of calves, which previously never
  // scored above 2 anywhere in the library
  s("calf_raise", "calves", 10), s("calf_raise", "hamstrings", 2),
  // External Rotation — the only primary driver of rotator_cuff
  s("external_rotation", "rotator_cuff", 10), s("external_rotation", "rear_delts", 4),

  // Farmer Carry — the only primary driver of forearms alongside Bar Hang
  s("farmer_carry", "forearms", 10), s("farmer_carry", "traps", 7),
  s("farmer_carry", "abs", 5), s("farmer_carry", "obliques", 5),
  s("farmer_carry", "glute_med", 4), s("farmer_carry", "calves", 3),
  s("farmer_carry", "lower_back", 3),
  // Farmer Carry (time) — same movement, clocked instead of measured
  s("timed_carry", "forearms", 10), s("timed_carry", "traps", 7),
  s("timed_carry", "abs", 5), s("timed_carry", "obliques", 5),
  s("timed_carry", "glute_med", 4), s("timed_carry", "calves", 3),
  s("timed_carry", "lower_back", 3),
  // Bar Hang
  s("bar_hang", "forearms", 10), s("bar_hang", "lats", 5), s("bar_hang", "abs", 3),
  s("bar_hang", "traps", 3), s("bar_hang", "rotator_cuff", 3),

  // Plank
  s("plank", "abs", 9), s("plank", "obliques", 5), s("plank", "serratus", 4),
  s("plank", "lower_back", 3), s("plank", "front_delts", 2),
  // Side Plank
  s("side_plank", "obliques", 10), s("side_plank", "abs", 6),
  s("side_plank", "glute_med", 6), s("side_plank", "side_delts", 3),
  // Copenhagen Plank — the only primary driver of adductors
  s("copenhagen_plank", "adductors", 10), s("copenhagen_plank", "obliques", 6),
  s("copenhagen_plank", "abs", 5), s("copenhagen_plank", "glute_med", 3),
  // Pallof Press
  s("pallof_press", "obliques", 10), s("pallof_press", "abs", 7),
  s("pallof_press", "front_delts", 3), s("pallof_press", "glute_med", 2),
  // Hanging Knee Raise — genuinely co-primary. The concentric is hip flexion
  // (iliopsoas, rectus femoris) AND lumbar flexion / posterior pelvic tilt
  // (rectus abdominis): two prime movers of different joint actions in one rep.
  s("hanging_knee_raise", "abs", 10), s("hanging_knee_raise", "hip_flexors", 10),
  s("hanging_knee_raise", "obliques", 5), s("hanging_knee_raise", "forearms", 3),
  // Lateral Walk
  s("lateral_walk", "glute_med", 10), s("lateral_walk", "glutes", 4),
  s("lateral_walk", "quads", 3),
  // Banded Clam Shell — hip external rotation against the band
  s("clam_shell", "glute_med", 9), s("clam_shell", "glutes", 5),
  // Fire Hydrant — quadruped hip abduction
  s("fire_hydrant", "glute_med", 9), s("fire_hydrant", "glutes", 4),
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
  // Hollow Hold
  s("hollow_hold", "abs", 10), s("hollow_hold", "hip_flexors", 5), s("hollow_hold", "quads", 2),
  // Russian Twist
  s("russian_twist", "obliques", 9), s("russian_twist", "abs", 6),
  s("russian_twist", "hip_flexors", 3),
  // Bicycle Crunch
  s("bicycle_crunch", "abs", 8), s("bicycle_crunch", "obliques", 8),
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
  em("face_pull", "band", { isDefault: true, bandRoles: ["resistance"], requiredEquipment: ["monster_bands", "rack"] }),
  em("band_pull_apart", "band", { isDefault: true, bandRoles: ["resistance"], requiredEquipment: ["monster_bands"], notes: "No anchor needed — you hold both ends." }),

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

  // ---- carry / hang ----
  em("farmer_carry", "dumbbell", { isDefault: true, requiredEquipment: ["dumbbells"] }),
  em("timed_carry", "dumbbell", { isDefault: true, requiredEquipment: ["dumbbells"] }),
  em("bar_hang", "bodyweight", { isDefault: true, requiredEquipment: ["pull_up_bar"] }),

  // ---- core ----
  em("plank", "bodyweight", { isDefault: true, requiredEquipment: ["floor"] }),
  em("side_plank", "bodyweight", { isDefault: true, defaultUnilateralMode: "single_side", requiredEquipment: ["floor"] }),
  em("copenhagen_plank", "bodyweight", { isDefault: true, defaultUnilateralMode: "single_side", requiredEquipment: ["floor", "bench"] }),
  em("pallof_press", "band", { isDefault: true, bandRoles: ["resistance"], defaultUnilateralMode: "single_side", requiredEquipment: ["monster_bands", "rack"] }),
  em("hanging_knee_raise", "bodyweight", { isDefault: true, requiredEquipment: ["pull_up_bar"] }),
  // Hip-band only. Fire Hydrant's bodyweight default also drives glute_med as
  // primary, so glute_med volume is no longer ordinal-only across the library.
  em("lateral_walk", "band", { isDefault: true, bandRoles: ["resistance"], requiredEquipment: ["hip_bands"] }),
  em("clam_shell", "band", { isDefault: true, bandRoles: ["resistance"], defaultUnilateralMode: "single_side", requiredEquipment: ["hip_bands", "floor"] }),
  em("fire_hydrant", "bodyweight", { isDefault: true, defaultUnilateralMode: "single_side", requiredEquipment: ["floor"] }),
  em("fire_hydrant", "band", { bandRoles: ["resistance"], defaultUnilateralMode: "single_side", requiredEquipment: ["hip_bands", "floor"] }),
  em("hanging_leg_raise", "bodyweight", { isDefault: true, requiredEquipment: ["pull_up_bar"] }),
  em("dead_bug", "bodyweight", { isDefault: true, requiredEquipment: ["floor"] }),
  em("bird_dog", "bodyweight", { isDefault: true, defaultUnilateralMode: "alternating", requiredEquipment: ["floor"] }),
  em("sit_up", "bodyweight", { isDefault: true, requiredEquipment: ["floor"] }),
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

// ---------------------------------------------------------------------------
// Lookups
// ---------------------------------------------------------------------------

export const exerciseById = new Map(exercises.map((e) => [e.id, e]));

export const scoresByExercise = groupBy(exerciseMuscleScores, (r) => r.exerciseId);

function groupBy<T, K>(rows: readonly T[], key: (row: T) => K): Map<K, T[]> {
  const out = new Map<K, T[]>();
  for (const row of rows) {
    const k = key(row);
    const existing = out.get(k);
    if (existing) existing.push(row);
    else out.set(k, [row]);
  }
  return out;
}
