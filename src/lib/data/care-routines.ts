import type { Routine, RoutineExercise } from "../types";
import { re } from "./routine-builder";

/**
 * Pre-built "Care" routines for common problems — rehab/prehab days built
 * from the evidence reviewed in docs/pt-exercise-references.md (per-routine
 * anchors noted below; keep prescriptions and doc in sync). Imported into
 * the live DB by importCareRoutines (add-only: a routine already present is
 * never touched, so user edits survive re-runs). Also merged into the seed
 * snapshot fallback.
 *
 * These are general-conditioning templates for a healthy household, not
 * medical advice — the doc carries the full disclaimer.
 *
 * Conventions: band rows say "progress by band rank" in notes (a routine row
 * can't pin a specific band — rank is chosen at log time); mobility rows are
 * 1 set / timed / rest 15, matching the routine editor's defaults; strength
 * rows keep RIR modest or null — care work is quality reps, not grinding.
 */

// ---------------------------------------------------------------------------
// Routines
// ---------------------------------------------------------------------------

export const careRoutines: readonly Routine[] = [
  {
    id: "r_low_back_care",
    name: "Care: Low Back (McGill Big 3)",
    notes:
      "Spine-sparing endurance work (McGill Big 3) plus gentle motion. Build hold quality, not load. Fine daily.",
  },
  {
    id: "r_knee_care",
    name: "Care: Knee (Patellofemoral)",
    notes:
      "Hip + quad strengthening — the evidence-backed recipe for kneecap pain. Keep everything in a comfortable range.",
  },
  {
    id: "r_shoulder_care",
    name: "Care: Shoulder (Cuff & Scapula)",
    notes:
      "Light, high-quality cuff and scapular work. Loads stay small on purpose — stop shy of pain, not shy of effort.",
  },
  {
    id: "r_hip_glute_care",
    name: "Care: Hips & Glute Activation",
    notes:
      "Glute med and bridge work for hip stability. Pairs well before lower-body training days.",
  },
  {
    id: "r_posture_care",
    name: "Care: Posture & Upper Back",
    notes:
      "Rear delts, lower traps, and pec length for desk-day shoulders. Feel the shoulder blades move, not the arms.",
  },
  {
    id: "r_achilles_hamstring_care",
    name: "Care: Ankle, Achilles & Hamstrings",
    notes:
      "Eccentric calf and hamstring work plus ankle range. Slow lowering is the point — count the seconds down.",
  },
];

// ---------------------------------------------------------------------------
// Rows
// ---------------------------------------------------------------------------

export const careRoutineExercises: readonly RoutineExercise[] = [
  // Low back — McGill 2015 (Big 3, ~10s braced holds, descending pyramids);
  // Coulombe 2017 (core stabilization for LBP).
  re("r_low_back_care", 1, "cat_cow", "bodyweight", { sets: 1, durationSeconds: 60, restSeconds: 15 }),
  re("r_low_back_care", 2, "mcgill_curl_up", "bodyweight", { sets: 3, repMin: 3, repMax: 5, restSeconds: 30, notes: "Descending pyramid (5-3-1 style), ~10s braced holds per rep, per side." }),
  re("r_low_back_care", 3, "side_plank", "bodyweight", { sets: 3, durationSeconds: 10, restSeconds: 30, unilateralMode: "single_side", notes: "Short braced holds (McGill style) — add reps over weeks, not seconds." }),
  re("r_low_back_care", 4, "bird_dog", "bodyweight", { sets: 3, repMin: 5, repMax: 8, restSeconds: 30, unilateralMode: "alternating", notes: "Pause 5-10s per rep; square hips." }),
  re("r_low_back_care", 5, "glute_bridge", "bodyweight", { sets: 2, repMin: 12, repMax: 15, restSeconds: 45 }),
  re("r_low_back_care", 6, "childs_pose", "bodyweight", { sets: 1, durationSeconds: 60, restSeconds: 15, notes: "Skip or shorten if end-range flexion aggravates symptoms." }),

  // Knee — Khayambashi 2014, Lack 2015, Willy 2019 (hip + knee > knee-only
  // for patellofemoral pain); Rio 2015 (isometrics for tendon pain).
  re("r_knee_care", 1, "band_tke", "band", { bandRole: "resistance", unilateralMode: "single_side", sets: 3, repMin: 15, repMax: 15, restSeconds: 45, notes: "Light band. Progress by band rank, not load." }),
  re("r_knee_care", 2, "wall_sit", "bodyweight", { sets: 3, durationSeconds: 30, restSeconds: 60, notes: "Build toward 4-5 holds of 45s — the studied analgesic dose is longer and heavier." }),
  re("r_knee_care", 3, "step_up", "bodyweight", { sets: 3, repMin: 8, repMax: 10, restSeconds: 60, unilateralMode: "single_side", notes: "Low box; 3s lowering." }),
  re("r_knee_care", 4, "side_lying_hip_abduction", "bodyweight", { sets: 3, repMin: 12, repMax: 15, restSeconds: 30, unilateralMode: "single_side" }),
  re("r_knee_care", 5, "clam_shell", "band", { bandRole: "resistance", unilateralMode: "single_side", sets: 2, repMin: 15, repMax: 15, restSeconds: 30, notes: "Progress by band rank, not load." }),
  re("r_knee_care", 6, "knee_to_wall", "bodyweight", { sets: 1, durationSeconds: 30, restSeconds: 15, unilateralMode: "single_side" }),
  re("r_knee_care", 7, "standing_quad_stretch", "bodyweight", { sets: 1, durationSeconds: 30, restSeconds: 15, unilateralMode: "single_side" }),

  // Shoulder — Kuhn 2009 / Holmgren 2012 (exercise for cuff/subacromial
  // pain); Ludewig 2004 (push-up plus); Reinold 2004/2007 (ER, full-can);
  // Cools 2007 (scapular balance).
  re("r_shoulder_care", 1, "scapular_push_up", "bodyweight", { sets: 2, repMin: 10, repMax: 12, restSeconds: 45 }),
  re("r_shoulder_care", 2, "external_rotation", "band", { bandRole: "resistance", unilateralMode: "single_side", sets: 3, repMin: 12, repMax: 15, restSeconds: 45, notes: "Lightest band. Progress by band rank, not load." }),
  re("r_shoulder_care", 3, "band_internal_rotation", "band", { bandRole: "resistance", unilateralMode: "single_side", sets: 2, repMin: 12, repMax: 15, restSeconds: 45, notes: "Progress by band rank, not load." }),
  re("r_shoulder_care", 4, "scaption_raise", "dumbbell", { sets: 3, repMin: 10, repMax: 12, restSeconds: 60, notes: "Light. Thumbs up; stop at shoulder height." }),
  re("r_shoulder_care", 5, "prone_ytw", "bodyweight", { sets: 2, repMin: 6, repMax: 8, restSeconds: 45, notes: "6-8 slow reps of each letter, within pain-free range." }),
  re("r_shoulder_care", 6, "band_pull_apart", "band", { bandRole: "resistance", sets: 2, repMin: 15, repMax: 15, restSeconds: 45, notes: "Palms up — biases lower traps over upper traps." }),
  re("r_shoulder_care", 7, "doorway_chest_stretch", "bodyweight", { sets: 1, durationSeconds: 30, restSeconds: 15 }),
  re("r_shoulder_care", 8, "bar_hang", "bodyweight", { sets: 2, durationSeconds: 20, restSeconds: 60, notes: "Optional — no direct evidence. Feet assisted; skip if it provokes pain." }),

  // Hips/glutes — Distefano 2009 + Boren 2011 (glute med hierarchy).
  re("r_hip_glute_care", 1, "glute_bridge", "bodyweight", { sets: 2, repMin: 12, repMax: 15, restSeconds: 45 }),
  re("r_hip_glute_care", 2, "lateral_walk", "band", { bandRole: "resistance", sets: 2, repMin: 15, repMax: 15, restSeconds: 45, notes: "Band at the ankles. Progress by band rank, not load." }),
  re("r_hip_glute_care", 3, "side_lying_hip_abduction", "bodyweight", { sets: 3, repMin: 12, repMax: 15, restSeconds: 30, unilateralMode: "single_side" }),
  re("r_hip_glute_care", 4, "clam_shell", "band", { bandRole: "resistance", unilateralMode: "single_side", sets: 2, repMin: 15, repMax: 15, restSeconds: 30, notes: "Progress by band rank, not load." }),
  re("r_hip_glute_care", 5, "single_leg_glute_bridge", "bodyweight", { sets: 2, repMin: 8, repMax: 10, restSeconds: 45, unilateralMode: "single_side" }),
  re("r_hip_glute_care", 6, "figure_four_stretch", "bodyweight", { sets: 1, durationSeconds: 30, restSeconds: 15, unilateralMode: "single_side" }),

  // Posture — Cools 2007, Hardwick 2006 (wall slides), honest hedging on
  // posture-pain claims lives in the doc.
  re("r_posture_care", 1, "wall_slide", "bodyweight", { sets: 2, repMin: 8, repMax: 10, restSeconds: 30 }),
  re("r_posture_care", 2, "band_pull_apart", "band", { bandRole: "resistance", sets: 3, repMin: 15, repMax: 15, restSeconds: 45, notes: "Palms up — biases lower traps over upper traps." }),
  re("r_posture_care", 3, "face_pull", "band", { bandRole: "resistance", sets: 3, repMin: 12, repMax: 15, restSeconds: 60, notes: "Progress by band rank, not load." }),
  re("r_posture_care", 4, "prone_ytw", "bodyweight", { sets: 2, repMin: 6, repMax: 8, restSeconds: 45 }),
  re("r_posture_care", 5, "thread_the_needle", "bodyweight", { sets: 1, durationSeconds: 30, restSeconds: 15, unilateralMode: "single_side" }),
  re("r_posture_care", 6, "doorway_chest_stretch", "bodyweight", { sets: 1, durationSeconds: 30, restSeconds: 15 }),

  // Ankle/achilles/hamstrings — Alfredson 1998 + Beyer 2015 (eccentric /
  // heavy-slow calf work); Petersen 2011 + van der Horst 2015 (Nordics).
  re("r_achilles_hamstring_care", 1, "calf_raise", "bodyweight", { sets: 3, repMin: 15, repMax: 15, restSeconds: 60, notes: "Alfredson-style: up on two legs, 3s single-leg lowering. Progress by adding load (backpack/dumbbell) over weeks." }),
  re("r_achilles_hamstring_care", 2, "tibialis_raise", "bodyweight", { sets: 3, repMin: 15, repMax: 15, restSeconds: 45 }),
  re("r_achilles_hamstring_care", 3, "nordic_curl", "bodyweight", { sets: 3, repMin: 3, repMax: 5, restSeconds: 90, notes: "Eccentric only — lower slow, push back up with hands." }),
  re("r_achilles_hamstring_care", 4, "single_leg_rdl", "dumbbell", { sets: 3, repMin: 8, repMax: 10, restSeconds: 60, unilateralMode: "single_side", targetRir: 3 }),
  re("r_achilles_hamstring_care", 5, "knee_to_wall", "bodyweight", { sets: 1, durationSeconds: 30, restSeconds: 15, unilateralMode: "single_side" }),
  re("r_achilles_hamstring_care", 6, "calf_stretch", "bodyweight", { sets: 1, durationSeconds: 30, restSeconds: 15, unilateralMode: "single_side" }),
  re("r_achilles_hamstring_care", 7, "standing_hamstring_stretch", "bodyweight", { sets: 1, durationSeconds: 30, restSeconds: 15, unilateralMode: "single_side" }),
];
