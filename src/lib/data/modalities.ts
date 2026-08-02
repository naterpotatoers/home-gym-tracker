import type { Modality } from "../types";

/**
 * How an exercise is loaded. An exercise × modality pair is a "variant".
 *
 * Muscle scores are authored once per exercise and *adjusted* here, never
 * re-authored per variant. 42 exercises × 3 modalities would be 126 hand-kept
 * score sets; this is 42 plus the five short modifier lists below.
 *
 * Every number here is a seeded coaching heuristic, not a measurement. The
 * directions are well supported — the bilateral deficit is real, dumbbell
 * pressing lands around 80-90% of barbell for the same reps, band tension
 * genuinely rises through the range — but no published figure transfers cleanly
 * to one lifter on one lift. `deriveLoadFactor()` replaces `seedLoadFactor`
 * with the client's own ratio once there's enough logged data, and the UI
 * shows which one it used.
 */
export const modalities: readonly Modality[] = [
  {
    id: "barbell",
    name: "Barbell",
    owned: true,
    stabilityDemand: 4,
    seedLoadFactor: 1.0, // the baseline everything else is expressed against
    romQuality: 6, // fixed bar path
    resistanceProfile: "constant",
    defaultLoadPrecision: "exact",
    skillDemand: 7,
    muscleModifiers: [{ muscleId: "forearms", delta: 1 }],
  },
  {
    id: "dumbbell",
    name: "Dumbbell",
    owned: true,
    // Two independent implements to control. This is the "dumbbells at 135 feel
    // harder than a bar at 135" effect, and it is why seedLoadFactor is < 1.
    stabilityDemand: 8,
    seedLoadFactor: 0.85,
    romQuality: 9, // deeper stretch, natural path
    resistanceProfile: "constant",
    defaultLoadPrecision: "exact",
    skillDemand: 5,
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
    stabilityDemand: 6,
    seedLoadFactor: null, // load is the lifter; not comparable to a bar
    romQuality: 7,
    resistanceProfile: "constant",
    defaultLoadPrecision: "exact",
    skillDemand: 3,
    muscleModifiers: [{ muscleId: "abs", delta: 1 }],
  },
  {
    id: "band",
    name: "Band",
    owned: true,
    stabilityDemand: 6,
    seedLoadFactor: null,
    romQuality: 7,
    // Hardest at end range, easiest at the stretch — backwards from where most
    // muscles produce peak force. A drawback under bandRole 'resistance', but
    // close to ideal under 'assistance': the band helps most at the bottom of a
    // pull-up, exactly where you're weakest, then tapers off.
    resistanceProfile: "ascending",
    // Null on purpose: loop bands are `approximate` (published lb range) while
    // hip bands are `ordinal` (rank only). "Band" is not one measurement scale,
    // so precision resolves from the specific band on the set.
    defaultLoadPrecision: null,
    skillDemand: 3,
    muscleModifiers: [],
  },
  {
    id: "machine",
    name: "Machine",
    owned: false, // kept so adding one later is a data edit, not a schema change
    stabilityDemand: 2,
    seedLoadFactor: 1.05, // guided path lets you move slightly more
    romQuality: 6,
    resistanceProfile: "matched",
    defaultLoadPrecision: "exact",
    skillDemand: 1,
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
