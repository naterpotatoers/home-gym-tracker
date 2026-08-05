import type { ExerciseId, ModalityId, Session, SetLog } from "../types";

/**
 * SEED DATA — inserted into Supabase once by /dev/seed, then dormant. The live
 * app reads sessions and set logs from the database snapshot, not from here.
 *
 * Logged work. Two tables instead of the old flat `workoutLogs`: a session says
 * who trained, when, and how it went; a set log is one row per set, ordered,
 * carrying its own modality.
 *
 * Every barbell weight below is a load the plate inventory can actually build,
 * and every dumbbell weight is one of the owned pairs. (Worth noting: the
 * original mock data logged dumbbell bench at 135, which is not reachable —
 * the heaviest pair is 50, so 100 lb total is the ceiling.)
 */
export const sessions: readonly Session[] = [
  // ---- Nate ----
  sess("s_nate_0615", "nate", "2026-06-15", 62, "Upper. Switched to dumbbells mid-bench to chase the stabilizer work."),
  sess("s_nate_0617", "nate", "2026-06-17", 58, "Lower."),
  sess("s_nate_0622", "nate", "2026-06-22", 55, "Upper, dumbbell emphasis."),
  sess("s_nate_0629", "nate", "2026-06-29", 60, "Upper, barbell."),
  sess("s_nate_0706", "nate", "2026-07-06", 57, "Upper, dumbbell emphasis."),
  sess("s_nate_0713", "nate", "2026-07-13", 64, "Upper, barbell."),
  sess("s_nate_0715", "nate", "2026-07-15", 71, "Lower, heavy."),
  sess("s_nate_0720", "nate", "2026-07-20", 56, "Upper, dumbbell emphasis."),
  sess("s_nate_0727", "nate", "2026-07-27", 66, "Upper, barbell. Took the top bench set to failure — spotter arms."),

  // ---- Lidia ----
  sess("s_lidia_0706", "lidia", "2026-07-06", 45, "Full body."),
  sess("s_lidia_0713", "lidia", "2026-07-13", 44, "Full body."),
  sess("s_lidia_0720", "lidia", "2026-07-20", 48, "First barbell squat session."),
  sess("s_lidia_0727", "lidia", "2026-07-27", 47, "Squat +2.5 lb. Dropped to the blue band on pull-ups."),

  // ---- Gabriel ----
  sess("s_gabriel_0725", "gabriel", "2026-07-25", 50, "Intro strength session."),

  // ---- Vivica ----
  sess("s_vivica_0724", "vivica", "2026-07-24", 52, "Glute and back emphasis."),
];

/** Ids are assigned in one pass below so there is no mutable counter to trip
 *  over during module initialisation. */
const rawSetLogs: readonly SetLog[] = [
  // =========================================================================
  // Nate — 2026-06-15, Upper
  // =========================================================================
  bar("s_nate_0615", "bench_press", 1, 135, 10, 3),
  bar("s_nate_0615", "bench_press", 2, 155, 8, 2),
  bar("s_nate_0615", "bench_press", 3, 165, 6, 1),
  // The intentional mid-session implement switch. Same exercise, same day,
  // different modality — two honest rows, not duplicates. Under the old flat
  // schema these were indistinguishable from a data-entry error.
  db("s_nate_0615", "bench_press", 4, 50, 10, 2, { notes: "Switched to dumbbells." }),
  db("s_nate_0615", "bench_press", 5, 50, 8, 1),
  bar("s_nate_0615", "bent_over_row", 1, 135, 10, 2),
  bar("s_nate_0615", "bent_over_row", 2, 135, 10, 2),
  bar("s_nate_0615", "bent_over_row", 3, 145, 8, 1),
  bw("s_nate_0615", "pull_up", 1, 8, 2),
  bw("s_nate_0615", "pull_up", 2, 7, 1),
  bw("s_nate_0615", "pull_up", 3, 6, 0),
  db("s_nate_0615", "lateral_raise", 1, 15, 15, 2),
  db("s_nate_0615", "lateral_raise", 2, 15, 15, 1),
  db("s_nate_0615", "lateral_raise", 3, 15, 13, 0),
  band("s_nate_0615", "face_pull", 1, "band_blue", { reps: 15, rir: 2 }),
  band("s_nate_0615", "face_pull", 2, "band_blue", { reps: 15, rir: 2 }),
  band("s_nate_0615", "face_pull", 3, "band_blue", { reps: 15, rir: 1 }),

  // =========================================================================
  // Nate — 2026-06-17, Lower
  // =========================================================================
  bar("s_nate_0617", "squat", 1, 185, 8, 3),
  bar("s_nate_0617", "squat", 2, 205, 6, 2),
  bar("s_nate_0617", "squat", 3, 225, 5, 1),
  bar("s_nate_0617", "romanian_deadlift", 1, 185, 10, 2),
  bar("s_nate_0617", "romanian_deadlift", 2, 185, 10, 2),
  bar("s_nate_0617", "romanian_deadlift", 3, 185, 9, 1),
  // Hip band: ordinal load only. No lb value exists, so no e1RM and no
  // normalized load — this progresses by band rank alone.
  band("s_nate_0617", "lateral_walk", 1, "hip_band_medium", { reps: 15 }),
  band("s_nate_0617", "lateral_walk", 2, "hip_band_medium", { reps: 15 }),
  hold("s_nate_0617", "copenhagen_plank", 1, 30, { unilateralMode: "single_side" }),
  hold("s_nate_0617", "copenhagen_plank", 2, 30, { unilateralMode: "single_side" }),

  // =========================================================================
  // Nate — 2026-06-22, Upper (dumbbell)
  // =========================================================================
  db("s_nate_0622", "bench_press", 1, 45, 12, 3),
  db("s_nate_0622", "bench_press", 2, 50, 10, 2),
  db("s_nate_0622", "bench_press", 3, 50, 9, 1),
  db("s_nate_0622", "chest_supported_row", 1, 40, 12, 2),
  db("s_nate_0622", "chest_supported_row", 2, 40, 12, 2),
  db("s_nate_0622", "chest_supported_row", 3, 40, 11, 1),
  db("s_nate_0622", "shoulder_press", 1, 35, 10, 2),
  db("s_nate_0622", "shoulder_press", 2, 35, 9, 1),
  db("s_nate_0622", "shoulder_press", 3, 30, 12, 1),
  band("s_nate_0622", "external_rotation", 1, "band_orange", { reps: 15, unilateralMode: "single_side" }),
  band("s_nate_0622", "external_rotation", 2, "band_orange", { reps: 15, unilateralMode: "single_side" }),
  hold("s_nate_0622", "bar_hang", 1, 45),
  hold("s_nate_0622", "bar_hang", 2, 40),

  // =========================================================================
  // Nate — 2026-06-29, Upper (barbell)
  // =========================================================================
  bar("s_nate_0629", "bench_press", 1, 140, 10, 3),
  bar("s_nate_0629", "bench_press", 2, 160, 8, 2),
  bar("s_nate_0629", "bench_press", 3, 170, 6, 1),
  bar("s_nate_0629", "bent_over_row", 1, 145, 10, 2),
  bar("s_nate_0629", "bent_over_row", 2, 145, 10, 2),
  bar("s_nate_0629", "bent_over_row", 3, 145, 9, 1),
  bar("s_nate_0629", "shrug", 1, 185, 12, 2),
  bar("s_nate_0629", "shrug", 2, 185, 12, 2),
  bar("s_nate_0629", "shrug", 3, 185, 10, 1),
  bw("s_nate_0629", "hanging_knee_raise", 1, 12, 2),
  bw("s_nate_0629", "hanging_knee_raise", 2, 10, 1),
  bw("s_nate_0629", "hanging_knee_raise", 3, 10, 0),

  // =========================================================================
  // Nate — 2026-07-06, Upper (dumbbell)
  // =========================================================================
  db("s_nate_0706", "bench_press", 1, 50, 10, 2),
  db("s_nate_0706", "bench_press", 2, 50, 11, 1),
  db("s_nate_0706", "bench_press", 3, 45, 12, 1),
  db("s_nate_0706", "single_arm_row", 1, 50, 10, 2, { unilateralMode: "single_side" }),
  db("s_nate_0706", "single_arm_row", 2, 50, 10, 2, { unilateralMode: "single_side" }),
  db("s_nate_0706", "single_arm_row", 3, 50, 9, 1, { unilateralMode: "single_side" }),
  db("s_nate_0706", "incline_bench_press", 1, 40, 10, 2),
  db("s_nate_0706", "incline_bench_press", 2, 40, 10, 1),
  db("s_nate_0706", "incline_bench_press", 3, 35, 12, 1),
  db("s_nate_0706", "hammer_curl", 1, 30, 12, 2),
  db("s_nate_0706", "hammer_curl", 2, 30, 11, 1),
  db("s_nate_0706", "hammer_curl", 3, 25, 12, 0),

  // =========================================================================
  // Nate — 2026-07-13, Upper (barbell)
  // =========================================================================
  bar("s_nate_0713", "bench_press", 1, 145, 10, 3),
  bar("s_nate_0713", "bench_press", 2, 165, 8, 2),
  bar("s_nate_0713", "bench_press", 3, 175, 5, 1),
  bw("s_nate_0713", "pull_up", 1, 10, 2),
  bw("s_nate_0713", "pull_up", 2, 8, 1),
  bw("s_nate_0713", "pull_up", 3, 7, 0),
  bar("s_nate_0713", "decline_bench_press", 1, 155, 8, 2),
  bar("s_nate_0713", "decline_bench_press", 2, 155, 8, 2),
  bar("s_nate_0713", "decline_bench_press", 3, 155, 7, 1),
  db("s_nate_0713", "calf_raise", 1, 50, 15, 2),
  db("s_nate_0713", "calf_raise", 2, 50, 15, 1),
  db("s_nate_0713", "calf_raise", 3, 50, 13, 0),

  // =========================================================================
  // Nate — 2026-07-15, Lower (heavy)
  // =========================================================================
  bar("s_nate_0715", "squat", 1, 195, 8, 3),
  bar("s_nate_0715", "squat", 2, 215, 6, 2),
  bar("s_nate_0715", "squat", 3, 235, 4, 1),
  bar("s_nate_0715", "deadlift", 1, 245, 5, 2),
  bar("s_nate_0715", "deadlift", 2, 265, 5, 1),
  bar("s_nate_0715", "deadlift", 3, 285, 3, 1),
  db("s_nate_0715", "bulgarian_split_squat", 1, 35, 10, 2, { unilateralMode: "single_side" }),
  db("s_nate_0715", "bulgarian_split_squat", 2, 35, 10, 1, { unilateralMode: "single_side" }),
  db("s_nate_0715", "bulgarian_split_squat", 3, 35, 8, 0, { unilateralMode: "single_side" }),
  bar("s_nate_0715", "wide_stance_squat", 1, 155, 10, 2),
  bar("s_nate_0715", "wide_stance_squat", 2, 155, 10, 2),
  bw("s_nate_0715", "back_extension", 1, 15, 2),
  bw("s_nate_0715", "back_extension", 2, 15, 1),
  bw("s_nate_0715", "back_extension", 3, 12, 0),
  band("s_nate_0715", "glute_bridge", 1, "hip_band_small", { reps: 20 }),
  band("s_nate_0715", "glute_bridge", 2, "hip_band_small", { reps: 20 }),

  // =========================================================================
  // Nate — 2026-07-20, Upper (dumbbell)
  // =========================================================================
  // Every working set is at the 50 lb ceiling — he cannot load dumbbell bench
  // any heavier, which is exactly why `deriveLoadFactor` flags this ratio as
  // ceiling-limited rather than treating it as a clean measurement.
  db("s_nate_0720", "bench_press", 1, 50, 12, 2),
  db("s_nate_0720", "bench_press", 2, 50, 11, 1),
  db("s_nate_0720", "bench_press", 3, 50, 10, 0),
  db("s_nate_0720", "chest_supported_row", 1, 45, 12, 2),
  db("s_nate_0720", "chest_supported_row", 2, 45, 12, 1),
  db("s_nate_0720", "chest_supported_row", 3, 45, 10, 0),
  carry("s_nate_0720", "farmer_carry", 1, 50, 100),
  carry("s_nate_0720", "farmer_carry", 2, 50, 100),
  carry("s_nate_0720", "farmer_carry", 3, 50, 80),
  hold("s_nate_0720", "side_plank", 1, 45, { unilateralMode: "single_side" }),
  hold("s_nate_0720", "side_plank", 2, 45, { unilateralMode: "single_side" }),

  // =========================================================================
  // Nate — 2026-07-27, Upper (barbell)
  // =========================================================================
  bar("s_nate_0727", "bench_press", 1, 145, 10, 3),
  bar("s_nate_0727", "bench_press", 2, 170, 7, 2),
  // RIR 0 alone is only reasonable because the spotter arms are set.
  bar("s_nate_0727", "bench_press", 3, 180, 5, 0, { notes: "To failure, spotter arms set." }),
  bar("s_nate_0727", "bent_over_row", 1, 155, 8, 2),
  bar("s_nate_0727", "bent_over_row", 2, 155, 8, 1),
  bar("s_nate_0727", "bent_over_row", 3, 155, 7, 0),
  db("s_nate_0727", "tricep_extension", 1, 30, 12, 2),
  db("s_nate_0727", "tricep_extension", 2, 30, 11, 1),
  db("s_nate_0727", "tricep_extension", 3, 25, 12, 0),
  hold("s_nate_0727", "plank", 1, 60),
  hold("s_nate_0727", "plank", 2, 60),
  hold("s_nate_0727", "plank", 3, 50),

  // =========================================================================
  // Lidia — 2026-07-06
  // =========================================================================
  db("s_lidia_0706", "goblet_squat", 1, 20, 12, 3),
  db("s_lidia_0706", "goblet_squat", 2, 20, 12, 2),
  db("s_lidia_0706", "goblet_squat", 3, 20, 10, 1),
  // Band ASSISTANCE, not resistance — the band unloads bodyweight. Ascending
  // tension is an advantage here: most help at the bottom, where she is weakest.
  assist("s_lidia_0706", "pull_up", 1, "band_green", 5),
  assist("s_lidia_0706", "pull_up", 2, "band_green", 5),
  assist("s_lidia_0706", "pull_up", 3, "band_green", 4),
  db("s_lidia_0706", "bench_press", 1, 15, 12, 3),
  db("s_lidia_0706", "bench_press", 2, 15, 12, 2),
  db("s_lidia_0706", "bench_press", 3, 15, 11, 1),
  bar("s_lidia_0706", "hip_thrust", 1, 95, 12, 3),
  bar("s_lidia_0706", "hip_thrust", 2, 95, 12, 2),
  bar("s_lidia_0706", "hip_thrust", 3, 95, 10, 1),
  band("s_lidia_0706", "lateral_walk", 1, "hip_band_medium", { reps: 15 }),
  band("s_lidia_0706", "lateral_walk", 2, "hip_band_medium", { reps: 15 }),
  hold("s_lidia_0706", "plank", 1, 30),
  hold("s_lidia_0706", "plank", 2, 30),
  hold("s_lidia_0706", "plank", 3, 25),

  // =========================================================================
  // Lidia — 2026-07-13
  // =========================================================================
  db("s_lidia_0713", "goblet_squat", 1, 25, 12, 3),
  db("s_lidia_0713", "goblet_squat", 2, 25, 12, 2),
  db("s_lidia_0713", "goblet_squat", 3, 25, 11, 1),
  assist("s_lidia_0713", "pull_up", 1, "band_green", 6),
  assist("s_lidia_0713", "pull_up", 2, "band_green", 6),
  assist("s_lidia_0713", "pull_up", 3, "band_green", 5),
  db("s_lidia_0713", "shoulder_press", 1, 10, 12, 3),
  db("s_lidia_0713", "shoulder_press", 2, 10, 12, 2),
  db("s_lidia_0713", "shoulder_press", 3, 10, 10, 1),
  db("s_lidia_0713", "romanian_deadlift", 1, 20, 12, 3),
  db("s_lidia_0713", "romanian_deadlift", 2, 20, 12, 2),
  db("s_lidia_0713", "romanian_deadlift", 3, 20, 11, 1),
  hold("s_lidia_0713", "side_plank", 1, 20, { unilateralMode: "single_side" }),
  hold("s_lidia_0713", "side_plank", 2, 20, { unilateralMode: "single_side" }),

  // =========================================================================
  // Lidia — 2026-07-20 — first barbell squat
  // =========================================================================
  bar("s_lidia_0720", "squat", 1, 65, 10, 3, { notes: "Empty-ish bar + 10s. Form focus." }),
  bar("s_lidia_0720", "squat", 2, 65, 10, 3),
  bar("s_lidia_0720", "squat", 3, 65, 10, 2),
  assist("s_lidia_0720", "pull_up", 1, "band_blue", 5, { notes: "Down a band from green." }),
  assist("s_lidia_0720", "pull_up", 2, "band_blue", 4),
  assist("s_lidia_0720", "pull_up", 3, "band_blue", 4),
  db("s_lidia_0720", "bench_press", 1, 20, 10, 3),
  db("s_lidia_0720", "bench_press", 2, 20, 10, 2),
  db("s_lidia_0720", "bench_press", 3, 20, 9, 1),
  bw("s_lidia_0720", "calf_raise", 1, 20, 2),
  bw("s_lidia_0720", "calf_raise", 2, 20, 2),
  bw("s_lidia_0720", "calf_raise", 3, 18, 1),
  band("s_lidia_0720", "pallof_press", 1, "band_red", { reps: 12, unilateralMode: "single_side" }),
  band("s_lidia_0720", "pallof_press", 2, "band_red", { reps: 12, unilateralMode: "single_side" }),

  // =========================================================================
  // Lidia — 2026-07-27 — the 2.5 lb jump the change plates now allow
  // =========================================================================
  bar("s_lidia_0727", "squat", 1, 67.5, 10, 3, { notes: "+2.5 lb. Impossible before the change plates." }),
  bar("s_lidia_0727", "squat", 2, 67.5, 10, 2),
  bar("s_lidia_0727", "squat", 3, 67.5, 10, 2),
  assist("s_lidia_0727", "pull_up", 1, "band_blue", 6),
  assist("s_lidia_0727", "pull_up", 2, "band_blue", 5),
  assist("s_lidia_0727", "pull_up", 3, "band_blue", 5),
  db("s_lidia_0727", "chest_supported_row", 1, 15, 12, 3),
  db("s_lidia_0727", "chest_supported_row", 2, 15, 12, 2),
  db("s_lidia_0727", "chest_supported_row", 3, 15, 11, 1),
  band("s_lidia_0727", "external_rotation", 1, "band_orange", { reps: 15, unilateralMode: "single_side" }),
  band("s_lidia_0727", "external_rotation", 2, "band_orange", { reps: 15, unilateralMode: "single_side" }),
  bw("s_lidia_0727", "hanging_knee_raise", 1, 8, 2),
  bw("s_lidia_0727", "hanging_knee_raise", 2, 7, 1),
  bw("s_lidia_0727", "hanging_knee_raise", 3, 6, 0),
  // Mobility. Carries no muscle scores and is excluded from volume entirely.
  hold("s_lidia_0727", "stretch", 1, 300),

  // =========================================================================
  // Gabriel — 2026-07-25
  // =========================================================================
  bar("s_gabriel_0725", "squat", 1, 135, 8, 3),
  bar("s_gabriel_0725", "squat", 2, 135, 8, 2),
  bar("s_gabriel_0725", "squat", 3, 135, 8, 2),
  bar("s_gabriel_0725", "bench_press", 1, 95, 10, 3),
  bar("s_gabriel_0725", "bench_press", 2, 95, 10, 2),
  bar("s_gabriel_0725", "bench_press", 3, 95, 9, 1),
  bar("s_gabriel_0725", "bent_over_row", 1, 95, 10, 3),
  bar("s_gabriel_0725", "bent_over_row", 2, 95, 10, 2),
  bar("s_gabriel_0725", "bent_over_row", 3, 95, 10, 2),
  hold("s_gabriel_0725", "plank", 1, 40),
  hold("s_gabriel_0725", "plank", 2, 40),
  hold("s_gabriel_0725", "plank", 3, 35),

  // =========================================================================
  // Vivica — 2026-07-24
  // =========================================================================
  bar("s_vivica_0724", "hip_thrust", 1, 115, 12, 3),
  bar("s_vivica_0724", "hip_thrust", 2, 115, 12, 2),
  bar("s_vivica_0724", "hip_thrust", 3, 115, 11, 1),
  db("s_vivica_0724", "bulgarian_split_squat", 1, 25, 10, 2, { unilateralMode: "single_side" }),
  db("s_vivica_0724", "bulgarian_split_squat", 2, 25, 10, 2, { unilateralMode: "single_side" }),
  db("s_vivica_0724", "bulgarian_split_squat", 3, 25, 8, 1, { unilateralMode: "single_side" }),
  db("s_vivica_0724", "chest_supported_row", 1, 20, 12, 3),
  db("s_vivica_0724", "chest_supported_row", 2, 20, 12, 2),
  db("s_vivica_0724", "chest_supported_row", 3, 20, 11, 1),
  db("s_vivica_0724", "lateral_raise", 1, 8, 15, 2),
  db("s_vivica_0724", "lateral_raise", 2, 8, 15, 2),
  db("s_vivica_0724", "lateral_raise", 3, 8, 12, 1),
  band("s_vivica_0724", "lateral_walk", 1, "hip_band_small", { reps: 15 }),
  band("s_vivica_0724", "lateral_walk", 2, "hip_band_small", { reps: 15 }),
  hold("s_vivica_0724", "copenhagen_plank", 1, 20, { unilateralMode: "single_side" }),
  hold("s_vivica_0724", "copenhagen_plank", 2, 20, { unilateralMode: "single_side" }),
];

// ---------------------------------------------------------------------------
// Row builders — one per load shape, so the tables above stay readable
// ---------------------------------------------------------------------------

function sess(
  id: string,
  clientId: Session["clientId"],
  date: string,
  durationMinutes: number,
  notes: string,
): Session {
  return {
    id,
    clientId,
    date,
    assignmentId: null,
    routineId: null,
    durationMinutes,
    rpe: null,
    condition: null,
    status: "completed",
    notes,
  };
}

function base(
  sessionId: string,
  exerciseId: ExerciseId,
  modalityId: ModalityId,
  setNumber: number,
  o: Partial<SetLog>,
): SetLog {
  return {
    id: "", // filled in by the id pass below
    sessionId,
    exerciseId,
    modalityId,
    position: 0, // filled in by the id pass below
    setNumber,
    unilateralMode: "bilateral",
    side: null,
    reps: null,
    weightLbs: null,
    addedWeightLbs: null,
    bandId: null,
    bandRole: null,
    durationSeconds: null,
    distanceFeet: null,
    rir: null,
    isWarmup: false,
    completed: true,
    notes: "",
    ...o,
  };
}

/** Barbell set. `weightLbs` is the total on the bar. */
function bar(
  sessionId: string,
  exerciseId: ExerciseId,
  setNumber: number,
  weightLbs: number,
  reps: number,
  rir: number,
  o: Partial<SetLog> = {},
): SetLog {
  return base(sessionId, exerciseId, "barbell", setNumber, { weightLbs, reps, rir, ...o });
}

/** Dumbbell set. `weightLbs` is PER IMPLEMENT; the total is derived. */
function db(
  sessionId: string,
  exerciseId: ExerciseId,
  setNumber: number,
  weightLbs: number,
  reps: number,
  rir: number,
  o: Partial<SetLog> = {},
): SetLog {
  return base(sessionId, exerciseId, "dumbbell", setNumber, { weightLbs, reps, rir, ...o });
}

/** Bodyweight set, reps for reps. */
function bw(
  sessionId: string,
  exerciseId: ExerciseId,
  setNumber: number,
  reps: number,
  rir: number,
  o: Partial<SetLog> = {},
): SetLog {
  return base(sessionId, exerciseId, "bodyweight", setNumber, { reps, rir, ...o });
}

/** Band set adding resistance. */
function band(
  sessionId: string,
  exerciseId: ExerciseId,
  setNumber: number,
  bandId: NonNullable<SetLog["bandId"]>,
  o: Partial<SetLog> = {},
): SetLog {
  return base(sessionId, exerciseId, "band", setNumber, {
    bandId,
    bandRole: "resistance",
    ...o,
  });
}

/** Band set REMOVING load — assisted pull-ups and dips. */
function assist(
  sessionId: string,
  exerciseId: ExerciseId,
  setNumber: number,
  bandId: NonNullable<SetLog["bandId"]>,
  reps: number,
  o: Partial<SetLog> = {},
): SetLog {
  return base(sessionId, exerciseId, "band", setNumber, {
    bandId,
    bandRole: "assistance",
    reps,
    ...o,
  });
}

/** Timed hold. */
function hold(
  sessionId: string,
  exerciseId: ExerciseId,
  setNumber: number,
  durationSeconds: number,
  o: Partial<SetLog> = {},
): SetLog {
  return base(sessionId, exerciseId, "bodyweight", setNumber, { durationSeconds, ...o });
}

/** Loaded carry, measured in feet. */
function carry(
  sessionId: string,
  exerciseId: ExerciseId,
  setNumber: number,
  weightLbs: number,
  distanceFeet: number,
  o: Partial<SetLog> = {},
): SetLog {
  return base(sessionId, exerciseId, "dumbbell", setNumber, {
    weightLbs,
    distanceFeet,
    ...o,
  });
}

// ---------------------------------------------------------------------------
// Lookups
// ---------------------------------------------------------------------------

export const setLogs: readonly SetLog[] = (() => {
  const positionInSession = new Map<string, number>();
  return rawSetLogs.map((set, i) => {
    const position = (positionInSession.get(set.sessionId) ?? 0) + 1;
    positionInSession.set(set.sessionId, position);
    return {
      ...set,
      id: `sl_${String(i + 1).padStart(3, "0")}`,
      position,
    };
  });
})();

export const sessionById = new Map(sessions.map((s) => [s.id, s]));

export const setsBySession = (() => {
  const out = new Map<string, SetLog[]>();
  for (const set of setLogs) {
    const existing = out.get(set.sessionId);
    if (existing) existing.push(set);
    else out.set(set.sessionId, [set]);
  }
  return out;
})();
