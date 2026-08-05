import type {
  Assignment,
  ExerciseId,
  ModalityId,
  Program,
  ProgramDay,
  Routine,
  RoutineExercise,
} from "../types";

export const routines: readonly Routine[] = [
  { id: "r_full_a", name: "Full Body A", notes: "Squat-led. Beginner." },
  { id: "r_full_b", name: "Full Body B", notes: "Hinge-led. Beginner." },
  { id: "r_upper_bb", name: "Upper — Barbell", notes: "Heavy pressing and rowing." },
  { id: "r_upper_db", name: "Upper — Dumbbell", notes: "Stability, range of motion, and asymmetry work." },
  { id: "r_lower", name: "Lower", notes: "Squat and deadlift focus." },
];

/**
 * Every entry pins a modality. "Bicep Curl 3x12" is not a prescription until it
 * says which implement — the load, the stability demand, and the strength curve
 * all change with it.
 */
export const routineExercises: readonly RoutineExercise[] = [
  // ---- Full Body A (beginner) ----
  // Barbell squat for a beginner is now the right call: with change plates it
  // steps 2.5 lb, versus 10 lb total for the fixed dumbbells.
  re("r_full_a", 1, "squat", "barbell", { sets: 3, repMin: 8, repMax: 10, restSeconds: 150, targetRir: 3 }),
  re("r_full_a", 2, "bench_press", "dumbbell", { sets: 3, repMin: 10, repMax: 12, restSeconds: 120, targetRir: 2 }),
  re("r_full_a", 3, "pull_up", "band", { sets: 3, repMin: 5, repMax: 8, restSeconds: 120, targetRir: 1, bandRole: "assistance", notes: "Lightest band that allows the rep range." }),
  re("r_full_a", 4, "hip_thrust", "barbell", { sets: 3, repMin: 10, repMax: 12, restSeconds: 90, targetRir: 2 }),
  re("r_full_a", 5, "lateral_walk", "band", { sets: 2, repMin: 15, repMax: 15, restSeconds: 60, bandRole: "resistance", notes: "Hip band. Progress by band rank, not load." }),
  re("r_full_a", 6, "plank", "bodyweight", { sets: 3, durationSeconds: 30, restSeconds: 45, supersetGroup: "core" }),
  re("r_full_a", 7, "side_plank", "bodyweight", { sets: 2, durationSeconds: 20, restSeconds: 45, unilateralMode: "single_side", supersetGroup: "core" }),

  // ---- Full Body B (beginner) ----
  re("r_full_b", 1, "romanian_deadlift", "dumbbell", { sets: 3, repMin: 10, repMax: 12, restSeconds: 120, targetRir: 3 }),
  re("r_full_b", 2, "shoulder_press", "dumbbell", { sets: 3, repMin: 10, repMax: 12, restSeconds: 120, targetRir: 2 }),
  re("r_full_b", 3, "chest_supported_row", "dumbbell", { sets: 3, repMin: 10, repMax: 12, restSeconds: 90, targetRir: 2 }),
  re("r_full_b", 4, "goblet_squat", "dumbbell", { sets: 3, repMin: 10, repMax: 12, restSeconds: 90, targetRir: 2 }),
  re("r_full_b", 5, "calf_raise", "bodyweight", { sets: 3, repMin: 15, repMax: 20, restSeconds: 45, supersetGroup: "accessory" }),
  re("r_full_b", 6, "external_rotation", "band", { sets: 2, repMin: 12, repMax: 15, restSeconds: 45, bandRole: "resistance", unilateralMode: "single_side", supersetGroup: "accessory", notes: "Prehab. Lightest band." }),
  re("r_full_b", 7, "stretch", "bodyweight", { sets: 1, durationSeconds: 300, restSeconds: 0 }),

  // ---- Upper, barbell ----
  // RIR 1 is only reasonable solo because the spotter arms are set.
  re("r_upper_bb", 1, "bench_press", "barbell", { sets: 3, repMin: 5, repMax: 8, restSeconds: 180, targetRir: 1 }),
  re("r_upper_bb", 2, "bent_over_row", "barbell", { sets: 3, repMin: 8, repMax: 10, restSeconds: 150, targetRir: 2 }),
  re("r_upper_bb", 3, "shoulder_press", "barbell", { sets: 3, repMin: 6, repMax: 8, restSeconds: 150, targetRir: 2 }),
  re("r_upper_bb", 4, "shrug", "barbell", { sets: 3, repMin: 10, repMax: 12, restSeconds: 90, targetRir: 1 }),
  re("r_upper_bb", 5, "hanging_knee_raise", "bodyweight", { sets: 3, repMin: 8, repMax: 12, restSeconds: 60, targetRir: 1 }),

  // ---- Upper, dumbbell ----
  re("r_upper_db", 1, "bench_press", "dumbbell", { sets: 3, repMin: 8, repMax: 12, restSeconds: 150, targetRir: 1, notes: "At the 50 lb ceiling — progress by reps, then swap to barbell." }),
  re("r_upper_db", 2, "single_arm_row", "dumbbell", { sets: 3, repMin: 8, repMax: 10, restSeconds: 120, targetRir: 1, unilateralMode: "single_side" }),
  re("r_upper_db", 3, "incline_bench_press", "dumbbell", { sets: 3, repMin: 10, repMax: 12, restSeconds: 120, targetRir: 2 }),
  re("r_upper_db", 4, "hammer_curl", "dumbbell", { sets: 3, repMin: 10, repMax: 12, restSeconds: 60, targetRir: 1, supersetGroup: "arms" }),
  re("r_upper_db", 5, "tricep_extension", "dumbbell", { sets: 3, repMin: 10, repMax: 12, restSeconds: 60, targetRir: 1, supersetGroup: "arms" }),
  re("r_upper_db", 6, "farmer_carry", "dumbbell", { sets: 3, restSeconds: 90, notes: "100 ft per set." }),

  // ---- Lower ----
  re("r_lower", 1, "squat", "barbell", { sets: 3, repMin: 4, repMax: 8, restSeconds: 210, targetRir: 1 }),
  re("r_lower", 2, "deadlift", "barbell", { sets: 3, repMin: 3, repMax: 5, restSeconds: 210, targetRir: 1 }),
  re("r_lower", 3, "bulgarian_split_squat", "dumbbell", { sets: 3, repMin: 8, repMax: 10, restSeconds: 120, targetRir: 1, unilateralMode: "single_side" }),
  re("r_lower", 4, "back_extension", "bodyweight", { sets: 3, repMin: 12, repMax: 15, restSeconds: 90, targetRir: 1 }),
  re("r_lower", 5, "calf_raise", "dumbbell", { sets: 3, repMin: 12, repMax: 15, restSeconds: 60, targetRir: 0, supersetGroup: "lower-accessory" }),
  re("r_lower", 6, "copenhagen_plank", "bodyweight", { sets: 2, durationSeconds: 30, restSeconds: 60, unilateralMode: "single_side", supersetGroup: "lower-accessory" }),
];

export const programs: readonly Program[] = [
  { id: "p_foundations", name: "Foundations", weeks: 8, notes: "Two full-body days a week. Beginner onboarding." },
  { id: "p_upper_lower", name: "Upper / Lower Split", weeks: 8, notes: "Four days. Alternates barbell and dumbbell upper days." },
];

/** dayOfWeek: 1 = Monday .. 7 = Sunday. */
export const programDays: readonly ProgramDay[] = [
  ...weeklyPattern("p_foundations", 8, [
    { dayOfWeek: 1, routineId: "r_full_a" },
    { dayOfWeek: 4, routineId: "r_full_b" },
  ]),
  ...weeklyPattern("p_upper_lower", 8, [
    { dayOfWeek: 1, routineId: "r_upper_bb" },
    { dayOfWeek: 2, routineId: "r_lower" },
    { dayOfWeek: 4, routineId: "r_upper_db" },
    { dayOfWeek: 5, routineId: "r_lower" },
  ]),
];

export const assignments: readonly Assignment[] = [
  { id: "a_lidia_foundations", programId: "p_foundations", clientId: "lidia", startDate: "2026-07-06", status: "active" },
  { id: "a_gabriel_foundations", programId: "p_foundations", clientId: "gabriel", startDate: "2026-07-20", status: "active" },
  { id: "a_vivica_foundations", programId: "p_foundations", clientId: "vivica", startDate: "2026-07-13", status: "active" },
  { id: "a_nate_ul", programId: "p_upper_lower", clientId: "nate", startDate: "2026-06-15", status: "active" },
];

// ---------------------------------------------------------------------------
// Builders
// ---------------------------------------------------------------------------

function re(
  routineId: string,
  order: number,
  exerciseId: ExerciseId,
  modalityId: ModalityId,
  o: Partial<Omit<RoutineExercise, "routineId" | "order" | "exerciseId" | "modalityId">>,
): RoutineExercise {
  return {
    routineId,
    order,
    exerciseId,
    modalityId,
    bandRole: null,
    unilateralMode: "bilateral",
    sets: 3,
    repMin: null,
    repMax: null,
    durationSeconds: null,
    restSeconds: 90,
    targetRir: null,
    supersetGroup: null,
    notes: "",
    ...o,
  };
}

/** The same weekly layout repeated for every week of the program. */
function weeklyPattern(
  programId: string,
  weeks: number,
  days: readonly { dayOfWeek: number; routineId: string }[],
): ProgramDay[] {
  const out: ProgramDay[] = [];
  for (let week = 1; week <= weeks; week++) {
    for (const day of days) {
      out.push({ programId, week, dayOfWeek: day.dayOfWeek, routineId: day.routineId });
    }
  }
  return out;
}
