import { isStrengthPattern } from "./exercise-catalog";
import type { GymData } from "./gym-data";
import { nextLoadStep } from "./loading";
import type { VariantRef } from "./modality";
import { utcDay } from "./periods";
import { exerciseHistory } from "./progress";
import type { ClientId, ModalityId, RoutineExercise, SetLog } from "./types";

/**
 * Progressive-overload helpers: double progression (fill the rep range, then
 * add the smallest load step) and the "you've stalled" check the runner
 * shows. Pure, over completed history only. Bands (ordinal — no pounds) and
 * cardio (watts) are out of scope; timed holds and carries too.
 */

/** A gap longer than this between exposures is a break — the streak (and
 *  the stall clock) restarts after it. */
export const MAX_GAP_DAYS = 14;
/** No improvement for at least this long, since the last best… */
export const STALL_DAYS = 21;
/** …across at least this many sessions after it. */
export const STALL_EXPOSURES = 2;
/** e1RM must rise this much to count as progress (rounding noise below). */
export const MIN_E1RM_GAIN = 0.01;

/** One completed session of a variant, reduced to what progress compares. */
export type Exposure = {
  sessionId: string;
  date: string;
  /** Working sets with reps and a load (bodyweight: added load, 0 if none). */
  sets: SetLog[];
  /** Heaviest load, and the reps of the sets done at it, in order. */
  top: number;
  topReps: number[];
  /** Best set's e1RM — null for bodyweight (weigh-in drift isn't progress). */
  e1rm: number | null;
};

export type Progression =
  | { kind: "add_load"; load: number; repMin: number; repMax: number }
  | { kind: "same_load"; load: number; targetReps: number; lastReps: number[] }
  | { kind: "at_ceiling"; load: number; lastReps: number[] };

export type StallHint = {
  /** Date of the last session that beat everything before it. */
  sinceDate: string;
  /** Days from that session to the check date. */
  days: number;
  /** Sessions since it, none better. */
  exposures: number;
  suggestion: Progression;
};

/** The number progress is measured in, per the SetLog's own field: the
 *  weight (per implement for dumbbells), added load for bodyweight, null for
 *  bands and cardio. */
function loadOf(set: SetLog): number | null {
  switch (set.modalityId) {
    case "barbell":
    case "dumbbell":
    case "machine":
    case "ankle_weight":
      return set.weightLbs;
    case "bodyweight":
      return set.addedWeightLbs ?? 0;
    case "band":
    case "cardio":
      return null;
  }
}

/** The sets that count (reps and a load), the heaviest load among them, and
 *  the reps done at it in order — null when none count. */
function topLoad(sets: readonly SetLog[]): { sets: SetLog[]; top: number; topReps: number[] } | null {
  const loaded = sets.filter((s) => (s.reps ?? 0) > 0 && loadOf(s) !== null);
  if (loaded.length === 0) return null;
  const top = Math.max(...loaded.map((s) => loadOf(s)!));
  return { sets: loaded, top, topReps: loaded.filter((s) => loadOf(s) === top).map((s) => s.reps!) };
}

/** Completed sessions of one variant on or before `asOf`, oldest first. */
export function variantExposures(
  data: GymData,
  clientId: ClientId,
  ref: VariantRef,
  asOf: string,
  excludeSessionId?: string,
): Exposure[] {
  const out: Exposure[] = [];
  for (const point of exerciseHistory(data, clientId, ref.exerciseId, ref.modalityId)) {
    if (point.date > asOf || point.sessionId === excludeSessionId) continue;
    const loaded = topLoad(point.sets);
    if (!loaded) continue;
    out.push({
      sessionId: point.sessionId,
      date: point.date,
      ...loaded,
      // The history's own best — sets without reps or a load have no e1RM.
      e1rm: ref.modalityId === "bodyweight" ? null : point.bestE1rmLbs,
    });
  }
  return out;
}

/** Did `cur` beat `prior`? A real e1RM gain; heavier at the same or more
 *  reps; more reps at the same or heavier load; or, at the same top load,
 *  more total reps across the sets (10/9/8 → 10/10/9 is progress). */
export function improves(cur: Exposure, prior: Exposure): boolean {
  if (cur.e1rm !== null && prior.e1rm !== null && cur.e1rm >= prior.e1rm * (1 + MIN_E1RM_GAIN)) {
    return true;
  }
  const curBest = Math.max(...cur.topReps);
  const priorBest = Math.max(...prior.topReps);
  if (cur.top > prior.top && curBest >= priorBest) return true;
  if (cur.top >= prior.top && curBest > priorBest) return true;
  if (cur.top === prior.top) {
    const k = Math.min(cur.topReps.length, prior.topReps.length);
    const sum = (reps: number[]) => reps.slice(0, k).reduce((a, b) => a + b, 0);
    return k > 0 && sum(cur.topReps) > sum(prior.topReps);
  }
  return false;
}

/**
 * Double progression from last session's sets: if every set at the top load
 * reached the top of the rep range, take the next load step and reset to the
 * bottom of the range; otherwise stay and add reps. Null for bands/cardio
 * or nothing loggable.
 */
export function doubleProgression(
  modalityId: ModalityId,
  lastSets: readonly SetLog[],
  rx?: Pick<RoutineExercise, "repMin" | "repMax">,
): Progression | null {
  const loaded = topLoad(lastSets);
  if (!loaded) return null;
  const { top, topReps: lastReps } = loaded;
  const repMax = rx?.repMax ?? rx?.repMin ?? null;
  if (repMax !== null && lastReps.every((r) => r >= repMax)) {
    const next = nextLoadStep(modalityId, top);
    return next === null
      ? { kind: "at_ceiling", load: top, lastReps }
      : { kind: "add_load", load: next, repMin: rx?.repMin ?? repMax, repMax };
  }
  return {
    kind: "same_load",
    load: top,
    targetReps: repMax ?? Math.max(...lastReps) + 1,
    lastReps,
  };
}

/**
 * Has this person stalled on this variant as of `asOf`? Only within a
 * continuous streak of training (no gap over MAX_GAP_DAYS, including up to
 * `asOf` — coming back from a break is never a stall): stalled when the last
 * session that beat every earlier one in the streak is ≥ STALL_DAYS old and
 * ≥ STALL_EXPOSURES sessions have happened since without beating it.
 */
export function stallFor(
  data: GymData,
  clientId: ClientId,
  ref: VariantRef,
  rx: Pick<RoutineExercise, "repMin" | "repMax"> | undefined,
  asOf: string,
  excludeSessionId?: string,
): StallHint | null {
  const exercise = data.exerciseById.get(ref.exerciseId);
  if (!exercise || !isStrengthPattern(exercise.pattern) || exercise.metricType !== "reps") return null;
  if (ref.modalityId === "band" || ref.modalityId === "cardio") return null;

  const all = variantExposures(data, clientId, ref, asOf, excludeSessionId);
  const last = all.at(-1);
  if (!last || utcDay(asOf) - utcDay(last.date) > MAX_GAP_DAYS) return null;

  let start = all.length - 1;
  while (start > 0 && utcDay(all[start].date) - utcDay(all[start - 1].date) <= MAX_GAP_DAYS) start--;
  const streak = all.slice(start);

  let lastImp = 0;
  for (let i = 1; i < streak.length; i++) {
    if (streak.slice(0, i).every((prior) => improves(streak[i], prior))) lastImp = i;
  }
  const exposures = streak.length - 1 - lastImp;
  const days = utcDay(asOf) - utcDay(streak[lastImp].date);
  if (exposures < STALL_EXPOSURES || days < STALL_DAYS) return null;

  const suggestion = doubleProgression(ref.modalityId, last.sets, rx);
  return suggestion ? { sinceDate: streak[lastImp].date, days, exposures, suggestion } : null;
}
