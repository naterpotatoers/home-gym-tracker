import type { Modality } from "../types";

/**
 * How an exercise is loaded. An exercise × modality pair is a "variant".
 *
 * Muscle scores are authored once per exercise and *adjusted* here, never
 * re-authored per variant. 42 exercises × 3 modalities would be 126 hand-kept
 * score sets; this is 42 plus the five short modifier lists below.
 *
 * `seedLoadFactor` is a seeded coaching heuristic, not a measurement. The
 * direction is well supported — dumbbell pressing lands around 80-90% of
 * barbell for the same reps — but no published figure transfers cleanly to
 * one lifter on one lift. `deriveLoadFactor()` replaces it with the client's
 * own ratio once there's enough logged data, and the UI shows which one it
 * used.
 */
/** Identity hues for modality tags — background-tinted chips, never status. */
export const MODALITY_COLORS: Record<import("../types").ModalityId, string> = {
  barbell: "#3987e5",
  dumbbell: "#8b5cf6",
  bodyweight: "#14b8a6",
  band: "#f97316",
  machine: "#06b6d4",
};

export const modalities: readonly Modality[] = [
  {
    id: "barbell",
    name: "Barbell",
    owned: true,
    seedLoadFactor: 1.0, // the baseline everything else is expressed against
    muscleModifiers: [{ muscleId: "forearms", delta: 1 }],
  },
  {
    id: "dumbbell",
    name: "Dumbbell",
    owned: true,
    // Two independent implements to control — the "dumbbells at 135 feel
    // harder than a bar at 135" effect, and why seedLoadFactor is < 1.
    seedLoadFactor: 0.85,
    muscleModifiers: [
      { muscleId: "rotator_cuff", delta: 3 },
      { muscleId: "serratus", delta: 1 },
      { muscleId: "forearms", delta: 1 },
    ],
  },
  {
    id: "bodyweight",
    name: "Bodyweight",
    owned: true,
    seedLoadFactor: null, // load is the lifter; not comparable to a bar
    muscleModifiers: [{ muscleId: "abs", delta: 1 }],
  },
  {
    id: "band",
    name: "Band",
    owned: true,
    seedLoadFactor: null,
    muscleModifiers: [],
  },
  {
    id: "machine",
    name: "Machine",
    owned: false, // kept so adding one later is a data edit, not a schema change
    seedLoadFactor: 1.05, // guided path lets you move slightly more
    // The machine takes over the stabilizing that free weights demand.
    muscleModifiers: [
      { muscleId: "rotator_cuff", delta: -2 },
      { muscleId: "abs", delta: -2 },
      { muscleId: "forearms", delta: -1 },
    ],
  },
];

export const modalityById = new Map(modalities.map((m) => [m.id, m]));

/** The modality every other one's load factor is expressed against. */
export const BASELINE_MODALITY_ID = "barbell" as const;
