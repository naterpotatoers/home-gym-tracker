import { bandById, dumbbells } from "./data/equipment";
import {
  exerciseModalities,
  exerciseById,
  scoresByExercise,
} from "./data/exercises";
import { BASELINE_MODALITY_ID, modalityById } from "./data/modalities";
import type { GymData } from "./gym-data";
import type {
  ClientId,
  ExerciseId,
  LoadPrecision,
  ModalityId,
  MuscleId,
  SetLog,
} from "./types";

// ---------------------------------------------------------------------------
// Muscle scores under a modality
// ---------------------------------------------------------------------------

/**
 * Base scores with the modality's modifiers applied, clamped to 0-10.
 *
 * A modifier only ever ADJUSTS a muscle the exercise already involves — it
 * never introduces one. The dumbbell modality adds +3 rotator_cuff, but a
 * dumbbell bicep curl still doesn't work the rotator cuff, so the delta has
 * nothing to apply to. Modality changes emphasis; it doesn't change anatomy.
 */
export function effectiveScores(
  exerciseId: ExerciseId,
  modalityId: ModalityId,
): Map<MuscleId, number> {
  const out = new Map<MuscleId, number>();
  const exercise = exerciseById.get(exerciseId);
  // Mobility work carries no scores and is excluded from volume entirely.
  if (!exercise || exercise.pattern === "mobility") return out;

  for (const row of scoresByExercise.get(exerciseId) ?? []) {
    out.set(row.muscleId, row.score);
  }
  const modality = modalityById.get(modalityId);
  if (!modality) return out;

  for (const mod of modality.muscleModifiers) {
    const base = out.get(mod.muscleId);
    if (base === undefined) continue; // adjust only, never introduce
    out.set(mod.muscleId, clamp(base + mod.delta, 0, 10));
  }
  return out;
}

// ---------------------------------------------------------------------------
// Load of a single set
// ---------------------------------------------------------------------------

export type SetLoad = {
  /** Total pounds moved per rep, or null when the load has no magnitude. */
  lbs: number | null;
  precision: LoadPrecision;
  /** Total reps across both sides. */
  totalReps: number;
};

const MAX_DUMBBELL_LBS = Math.max(...dumbbells.map((d) => d.weightLbs));

/** How many implements move in a single rep. */
function implementsPerRep(set: SetLog): number {
  if (set.modalityId !== "dumbbell") return 1;
  // Known simplification: an alternating curl moves one dumbbell per rep while
  // an alternating lunge carries both. Treating alternating as two slightly
  // overcounts the former. Splitting them would need a per-variant field.
  return set.unilateralMode === "single_side" ? 1 : 2;
}

/** Sides worked. Reps are stored PER SIDE, so this is the multiplier. */
export function sidesWorked(set: SetLog): number {
  return set.unilateralMode === "bilateral" ? 1 : 2;
}

/**
 * What a set actually loaded. Handles the five load shapes:
 * plates, dumbbells (per-implement), bodyweight ± added weight, band
 * resistance (approximate range), and band assistance (subtracts).
 */
export function setLoad(data: GymData, set: SetLog): SetLoad {
  const totalReps = (set.reps ?? 0) * sidesWorked(set);
  const bodyweight = bodyweightOn(data, set);

  if (set.modalityId === "barbell" || set.modalityId === "machine") {
    return { lbs: set.weightLbs, precision: "exact", totalReps };
  }

  if (set.modalityId === "dumbbell") {
    const lbs =
      set.weightLbs === null ? null : set.weightLbs * implementsPerRep(set);
    return { lbs, precision: "exact", totalReps };
  }

  if (set.modalityId === "bodyweight") {
    if (bodyweight === null) {
      return { lbs: null, precision: "exact", totalReps };
    }
    return { lbs: bodyweight + (set.addedWeightLbs ?? 0), precision: "exact", totalReps };
  }

  // Band. Precision comes from the specific band, not the modality: loop bands
  // publish a tension range, hip bands publish nothing at all.
  const band = set.bandId ? bandById.get(set.bandId) : undefined;
  if (!band) {
    return { lbs: null, precision: "approximate", totalReps };
  }

  if (band.family === "hip") {
    // Hip bands have no lb rating — rank only.
    return { lbs: null, precision: "ordinal", totalReps };
  }

  const midpoint = (band.minLbs + band.maxLbs) / 2;

  if (set.bandRole === "assistance") {
    if (bodyweight === null) {
      return { lbs: null, precision: "approximate", totalReps };
    }
    // The band takes load OFF. Ascending tension is an advantage here: most
    // help at the bottom, where the lifter is weakest.
    return { lbs: Math.max(0, bodyweight - midpoint), precision: "approximate", totalReps };
  }

  return { lbs: midpoint, precision: "approximate", totalReps };
}

/** Bodyweight from the most recent weigh-in on or before the set's session. */
function bodyweightOn(data: GymData, set: SetLog): number | null {
  const session = data.sessionById.get(set.sessionId);
  if (!session) return null;
  return latestBodyweight(data, session.clientId, session.date);
}

export function latestBodyweight(
  data: GymData,
  clientId: ClientId,
  onOrBefore: string,
): number | null {
  let best: { date: string; lbs: number } | null = null;
  for (const w of data.weighIns) {
    if (w.clientId !== clientId) continue;
    if (w.date > onOrBefore) continue;
    if (!best || w.date > best.date) best = { date: w.date, lbs: w.bodyweightLbs };
  }
  return best?.lbs ?? null;
}

// ---------------------------------------------------------------------------
// e1RM
// ---------------------------------------------------------------------------

/**
 * Epley estimated 1RM. Returns null for anything without a real load — a hip
 * band set has no magnitude, so there is nothing to extrapolate from.
 */
export function e1rm(data: GymData, set: SetLog): number | null {
  const load = setLoad(data, set);
  if (load.precision === "ordinal") return null;
  if (load.lbs === null || set.reps === null || set.reps <= 0) return null;
  if (set.isWarmup) return null;
  return load.lbs * (1 + set.reps / 30);
}

export function bestE1rm(data: GymData, sets: readonly SetLog[]): number | null {
  let best: number | null = null;
  for (const set of sets) {
    const value = e1rm(data, set);
    if (value !== null && (best === null || value > best)) best = value;
  }
  return best;
}

// ---------------------------------------------------------------------------
// Load factors: seeded, then measured from the client's own sets
// ---------------------------------------------------------------------------

export type LoadFactor = {
  factor: number;
  source: "seed" | "measured";
  /** Working sets found for this modality. */
  sampleSize: number;
  sessionCount: number;
  /**
   * True when the heaviest set used the heaviest implement available. The ratio
   * is then a floor, not a measurement: Nate cannot load dumbbell bench past
   * 100 lb total, so extra reps inflate the denominator and the measured factor
   * understates his real dumbbell:barbell ratio. `effectiveLoadFactor` falls
   * back to the seed in this case.
   */
  ceilingLimited: boolean;
};

const MIN_SETS = 6;
const MIN_SESSIONS = 3;

function workingSetsFor(
  data: GymData,
  clientId: ClientId,
  exerciseId: ExerciseId,
  modalityId: ModalityId,
): SetLog[] {
  return data.setLogs.filter((set) => {
    if (set.exerciseId !== exerciseId || set.modalityId !== modalityId) return false;
    if (set.isWarmup || !set.completed) return false;
    return data.sessionById.get(set.sessionId)?.clientId === clientId;
  });
}

/**
 * The client's own measured ratio for a variant, or the seeded heuristic when
 * there isn't enough data. Per-client on purpose — Lidia's dumbbell:barbell
 * ratio will not match Nate's.
 *
 * The seed is never overwritten in the data files; this returns which source
 * it used so the UI can say so.
 */
export function deriveLoadFactor(
  data: GymData,
  clientId: ClientId,
  exerciseId: ExerciseId,
  modalityId: ModalityId,
): LoadFactor {
  const modality = modalityById.get(modalityId);
  const override = exerciseModalities.find(
    (em) => em.exerciseId === exerciseId && em.modalityId === modalityId,
  )?.loadFactorOverride;
  const seed = override ?? modality?.seedLoadFactor ?? 1;

  const sets = workingSetsFor(data, clientId, exerciseId, modalityId);
  const sessionCount = new Set(sets.map((s) => s.sessionId)).size;
  const fallback: LoadFactor = {
    factor: seed,
    source: "seed",
    sampleSize: sets.length,
    sessionCount,
    ceilingLimited: false,
  };

  if (modalityId === BASELINE_MODALITY_ID) return { ...fallback, factor: 1 };
  if (sets.length < MIN_SETS || sessionCount < MIN_SESSIONS) return fallback;

  const baselineSets = workingSetsFor(data, clientId, exerciseId, BASELINE_MODALITY_ID);
  const baseline = bestE1rm(data, baselineSets);
  const mine = bestE1rm(data, sets);
  if (baseline === null || mine === null || baseline <= 0) return fallback;

  const ceilingLimited =
    modalityId === "dumbbell" &&
    sets.some((s) => s.weightLbs !== null && s.weightLbs >= MAX_DUMBBELL_LBS);

  return {
    factor: mine / baseline,
    source: "measured",
    sampleSize: sets.length,
    sessionCount,
    ceilingLimited,
  };
}

/**
 * The factor to actually use in load math. Prefers a measured ratio, but falls
 * back to the seed when the measurement is ceiling-limited, since a number
 * produced by an equipment cap is worse than an honest estimate.
 */
export function effectiveLoadFactor(
  data: GymData,
  clientId: ClientId,
  exerciseId: ExerciseId,
  modalityId: ModalityId,
): LoadFactor {
  const derived = deriveLoadFactor(data, clientId, exerciseId, modalityId);
  if (derived.source === "measured" && derived.ceilingLimited) {
    const modality = modalityById.get(modalityId);
    return { ...derived, factor: modality?.seedLoadFactor ?? derived.factor };
  }
  return derived;
}

/**
 * Load expressed as barbell-equivalent pounds, so one chart can plot a lift
 * across every modality it has been trained with instead of fragmenting into
 * separate lines. Null where the load has no magnitude.
 */
export function normalizedLoad(data: GymData, set: SetLog): number | null {
  const load = setLoad(data, set);
  if (load.lbs === null || load.precision === "ordinal") return null;
  const session = data.sessionById.get(set.sessionId);
  if (!session) return null;
  if (!data.clientById.has(session.clientId)) return null;

  const { factor } = effectiveLoadFactor(
    data,
    session.clientId,
    set.exerciseId,
    set.modalityId,
  );
  if (!factor) return load.lbs;
  return load.lbs / factor;
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

