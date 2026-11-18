import type { Routine, RoutineExercise } from "../types";
import { re } from "./routine-builder";

/**
 * Pre-built "Core" finishers — AthleanX-style ab circuits for the end of a
 * workout: three exercises run back to back as one superset, rest only after
 * the round, three rounds, under ~10 minutes (enforced in
 * care-routines.test.ts). Offered as finishers beside the Care routines and
 * reach the live DB the same way (/programs "Add" / "Update" built-ins).
 */

/** Core finishers are plain routines — the `_core` id suffix on built-ins,
 *  or a "Core:" name for hand-made ones. Kept out of the day-to-day picker's
 *  "Other routines" and offered as finishers. */
export function isCoreRoutine(routine: Pick<Routine, "id" | "name">): boolean {
  return routine.id.endsWith("_core") || /^core\s*:/i.test(routine.name);
}

export const coreRoutines: readonly Routine[] = [
  {
    id: "r_abs_circuit_core",
    name: "Core: Abs Circuit",
    notes:
      "Lower abs, rotation, then a hold — back to back, rest after the round. Slow reps; feel the abs, not the hip flexors.",
  },
  {
    id: "r_obliques_core",
    name: "Core: Obliques",
    notes:
      "Rotation and side-bend control. Turn from the ribs, not the arms; rest after the round.",
  },
  {
    id: "r_stability_core",
    name: "Core: Stability",
    notes:
      "Anti-extension and anti-rotation — the back-friendly circuit. Brace like you're about to be poked in the belly.",
  },
];

export const coreRoutineExercises: readonly RoutineExercise[] = [
  re("r_abs_circuit_core", 1, "hanging_knee_raise", "bodyweight", { sets: 3, repMin: 10, repMax: 15, restSeconds: 45, supersetGroup: "A", notes: "Curl the pelvis up toward the chest — no swinging." }),
  re("r_abs_circuit_core", 2, "bicycle_crunch", "bodyweight", { sets: 3, repMin: 20, repMax: 20, restSeconds: 45, supersetGroup: "A", notes: "20 total, slow. Shoulder blade to the opposite knee." }),
  re("r_abs_circuit_core", 3, "hollow_hold", "bodyweight", { sets: 3, durationSeconds: 20, restSeconds: 45, supersetGroup: "A", notes: "Low back pinned. Bend the knees to make it easier." }),

  re("r_obliques_core", 1, "woodchopper", "band", { bandRole: "resistance", unilateralMode: "single_side", sets: 3, repMin: 8, repMax: 8, restSeconds: 45, supersetGroup: "A", notes: "Pivot the back foot; arms stay long. Progress by band rank." }),
  re("r_obliques_core", 2, "russian_twist", "bodyweight", { sets: 3, repMin: 16, repMax: 16, restSeconds: 45, supersetGroup: "A", notes: "16 total. Rotate the ribs, not just the hands." }),
  re("r_obliques_core", 3, "side_plank", "bodyweight", { sets: 3, durationSeconds: 15, restSeconds: 45, unilateralMode: "single_side", supersetGroup: "A", notes: "Hips high, body in one line." }),

  re("r_stability_core", 1, "dead_bug", "bodyweight", { sets: 3, repMin: 6, repMax: 6, restSeconds: 45, supersetGroup: "A", notes: "6 per side. Low back stays pinned; exhale as you reach." }),
  re("r_stability_core", 2, "pallof_press", "band", { bandRole: "resistance", unilateralMode: "single_side", sets: 3, repMin: 8, repMax: 8, restSeconds: 45, supersetGroup: "A", notes: "Press out and hold 2 s — don't let the band turn you. Progress by band rank." }),
  re("r_stability_core", 3, "plank", "bodyweight", { sets: 3, durationSeconds: 30, restSeconds: 45, supersetGroup: "A", notes: "Squeeze glutes and quads; ribs down." }),
];
