import type { Routine, RoutineExercise } from "../types";
import { re } from "./routine-builder";

/**
 * Pre-built "Care" routines for common problems — short wind-down finishers
 * (≤3 exercises, under ~10 minutes; enforced in care-routines.test.ts) built
 * from the evidence reviewed in docs/pt-exercise-references.md (per-routine
 * anchors noted below; keep prescriptions and doc in sync). Reach the live DB
 * through /programs: "Add" creates missing built-ins, "Update" overwrites
 * built-ins that drifted from these rows (builtInRoutineDrift). Also merged
 * into the seed snapshot fallback.
 *
 * These are general-conditioning templates for a healthy household, not
 * medical advice — the doc carries the full disclaimer.
 *
 * Conventions: band rows say "progress by band rank" in notes (a routine row
 * can't pin a specific band — rank is chosen at log time); mobility rows are
 * timed / rest 15; strength rows keep RIR null — care work is quality reps,
 * not grinding. Superset members share the round's rest (the runner only
 * rests after the group's last row).
 */

/** Care routines are plain routines — identified by the `_care` id suffix
 *  every built-in one carries, or a "Care:" name for hand-made ones. Used to
 *  keep them out of the day-to-day picker and offer them as finishers. */
export function isCareRoutine(routine: Pick<Routine, "id" | "name">): boolean {
  return routine.id.endsWith("_care") || /^care\s*:/i.test(routine.name);
}

// ---------------------------------------------------------------------------
// Routines
// ---------------------------------------------------------------------------

export const careRoutines: readonly Routine[] = [
  {
    id: "r_low_back_care",
    name: "Care: Low Back (McGill Big 3)",
    notes:
      "The McGill Big 3 — spine-sparing endurance. Short braced holds, quality over load. Fine daily.",
  },
  {
    id: "r_knee_care",
    name: "Care: Knee (Patellofemoral)",
    notes:
      "Quad isometric plus hip and quad strength — the evidence-backed recipe for kneecap pain. Stay in a comfortable range.",
  },
  {
    id: "r_shoulder_care",
    name: "Care: Shoulder (Cuff & Scapula)",
    notes:
      "Light cuff and scapular work. Loads stay small on purpose — stop shy of pain, not shy of effort.",
  },
  {
    id: "r_hip_glute_care",
    name: "Care: Hips & Glutes",
    notes:
      "Glute max and glute med for hip stability, then a hip stretch to wind down.",
  },
  {
    id: "r_posture_care",
    name: "Care: Posture & Upper Back",
    notes:
      "Lower traps, rear delts and pec length for desk-day shoulders. Feel the shoulder blades move, not the arms.",
  },
  {
    id: "r_achilles_hamstring_care",
    name: "Care: Ankle & Achilles",
    notes:
      "Slow calf work, shin strength and ankle range. Pain up to 3/10 that settles by the next morning is OK.",
  },
];

// ---------------------------------------------------------------------------
// Rows
// ---------------------------------------------------------------------------

export const careRoutineExercises: readonly RoutineExercise[] = [
  // Low back — McGill 2015 (Big 3, ~10s braced holds); Coulombe 2017 (core
  // stabilization for LBP).
  re("r_low_back_care", 1, "mcgill_curl_up", "bodyweight", { sets: 2, repMin: 5, repMax: 5, restSeconds: 20, notes: "~10 s braced hold each rep. Hands under the low back, one knee bent." }),
  re("r_low_back_care", 2, "side_plank", "bodyweight", { sets: 2, durationSeconds: 10, restSeconds: 20, unilateralMode: "single_side", notes: "Short braced holds — add reps over weeks, not seconds." }),
  re("r_low_back_care", 3, "bird_dog", "bodyweight", { sets: 2, repMin: 4, repMax: 4, restSeconds: 20, unilateralMode: "alternating", notes: "~10 s hold each rep; hips square, no arching." }),

  // Knee — Rio 2015 (isometrics for pain); Khayambashi 2014, Lack 2015,
  // Willy 2019 (hip + knee > knee-only for patellofemoral pain).
  re("r_knee_care", 1, "wall_sit", "bodyweight", { sets: 2, durationSeconds: 30, restSeconds: 30, notes: "Comfortable depth. Build toward 45 s holds." }),
  re("r_knee_care", 2, "band_tke", "band", { bandRole: "resistance", unilateralMode: "single_side", sets: 2, repMin: 10, repMax: 10, restSeconds: 30, supersetGroup: "A", notes: "Squeeze the quad to full lockout. Progress by band rank." }),
  re("r_knee_care", 3, "side_lying_hip_abduction", "bodyweight", { sets: 2, repMin: 15, repMax: 15, restSeconds: 30, unilateralMode: "single_side", supersetGroup: "A", notes: "Heel leads, toes slightly down." }),

  // Shoulder — Reinold 2004/2007 (ER, scaption); Ludewig 2004 (push-up plus);
  // Kuhn 2009 / Holmgren 2012 (exercise for cuff pain).
  re("r_shoulder_care", 1, "external_rotation", "band", { bandRole: "resistance", unilateralMode: "single_side", sets: 2, repMin: 12, repMax: 12, restSeconds: 45, supersetGroup: "A", notes: "Elbow pinned to your side. Lightest band; progress by band rank." }),
  re("r_shoulder_care", 2, "scaption_raise", "dumbbell", { sets: 2, repMin: 10, repMax: 10, restSeconds: 45, supersetGroup: "A", notes: "Light. Thumbs up; stop at shoulder height." }),
  re("r_shoulder_care", 3, "scapular_push_up", "bodyweight", { sets: 2, repMin: 10, repMax: 10, restSeconds: 30, notes: "Arms locked — push the floor away at the top." }),

  // Hips/glutes — Distefano 2009 + Boren 2011 (glute med hierarchy).
  re("r_hip_glute_care", 1, "glute_bridge", "bodyweight", { sets: 2, repMin: 15, repMax: 15, restSeconds: 30, supersetGroup: "A", notes: "Ribs down, 1 s squeeze at the top." }),
  re("r_hip_glute_care", 2, "side_lying_hip_abduction", "bodyweight", { sets: 2, repMin: 15, repMax: 15, restSeconds: 30, unilateralMode: "single_side", supersetGroup: "A", notes: "Top leg slightly behind you; heel leads." }),
  re("r_hip_glute_care", 3, "figure_four_stretch", "bodyweight", { sets: 1, durationSeconds: 30, restSeconds: 15, unilateralMode: "single_side" }),

  // Posture — Cools 2007, Hardwick 2006 (wall slides); honest hedging on
  // posture-pain claims lives in the doc.
  re("r_posture_care", 1, "wall_slide", "bodyweight", { sets: 3, repMin: 10, repMax: 10, restSeconds: 30, supersetGroup: "A", notes: "Back and forearms on the wall; no arching." }),
  re("r_posture_care", 2, "band_pull_apart", "band", { bandRole: "resistance", sets: 3, repMin: 15, repMax: 15, restSeconds: 30, supersetGroup: "A", notes: "Palms up — biases lower traps. Progress by band rank." }),
  re("r_posture_care", 3, "doorway_chest_stretch", "bodyweight", { sets: 2, durationSeconds: 30, restSeconds: 15 }),

  // Ankle/achilles — Alfredson 1998 + Beyer 2015 (slow / heavy-slow calf
  // work), Silbernagel 2007 (pain-monitoring model).
  re("r_achilles_hamstring_care", 1, "calf_raise", "bodyweight", { sets: 3, repMin: 12, repMax: 12, restSeconds: 45, notes: "Up on two legs, 3 s down. Set 3 knees bent (soleus). Add load over weeks." }),
  re("r_achilles_hamstring_care", 2, "tibialis_raise", "bodyweight", { sets: 2, repMin: 15, repMax: 15, restSeconds: 30 }),
  re("r_achilles_hamstring_care", 3, "knee_to_wall", "bodyweight", { sets: 1, durationSeconds: 30, restSeconds: 15, unilateralMode: "single_side", notes: "Heel down; note if one side is tighter." }),
];
