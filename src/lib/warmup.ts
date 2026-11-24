import { isFinisherRoutine } from "./built-in-routines";
import {
  conditioningOf,
  DEFAULT_WARMUP_SCHEME,
  parseIntervalScheme,
  pieceSeconds,
  pieceShape,
  rollForward,
  schemeSeconds,
  targetOf,
  warmupPieces,
} from "./conditioning";
import { re } from "./data/routine-builder";
import { isStrengthPattern } from "./exercise-catalog";
import type { GymData } from "./gym-data";
import { variantOf } from "./modality";
import type { ClientId, ConditioningTarget, RoutineExercise, SetLog } from "./types";

/**
 * The Echo Bike warm-up before every lifting session (skippable per start
 * from the launcher, and with one tap in the session). It's a real
 * conditioning SetLog flagged isWarmup, so every strength number and the
 * finisher pieces' targets ignore it (workingSets drops warm-ups); it has
 * its own progress series instead (warmupSummary). Each person's warm-up
 * picks up from their last one (warmupPlan) — a first one is the console's
 * INT 20/10 (4:00). This synthetic prescription gives the runner its rx line
 * and rest. Not a routine row — routines stay as authored.
 */
/** The default warm-up's effort — every label that describes it (the bike
 *  row's hint, the runner's rx line) reads this. */
export const WARMUP_EFFORT = "RPE 3–4";

export const BIKE_WARMUP_RX: RoutineExercise = re("__warmup", 0, "echo_bike", "cardio", {
  sets: 1,
  durationSeconds: schemeSeconds(parseIntervalScheme(DEFAULT_WARMUP_SCHEME)!),
  restSeconds: 60,
  notes: `Easy, ${WARMUP_EFFORT} — build into it; don't race the console.`,
  conditioning: { intervalScheme: DEFAULT_WARMUP_SCHEME, targetWatts: null, targetRpm: null },
});

/** A first warm-up's length in minutes (4 — the 20/10 ×8 preset). */
export const WARMUP_MINUTES = (BIKE_WARMUP_RX.durationSeconds ?? 0) / 60;

/**
 * This person's next warm-up: their last one's piece (scheme, or a steady
 * piece's length) and target, bumped once after two hits in a row at that
 * target (rollForward) — only same-shape warm-ups count. No warm-ups yet →
 * the default 20/10 with no target.
 */
export function warmupPlan(
  data: GymData,
  clientId: ClientId,
): { target: ConditioningTarget; durationSeconds: number } {
  const history = warmupPieces(data, clientId, BIKE_WARMUP_RX.exerciseId);
  const last = history[0];
  if (!last) {
    return { target: targetOf(BIKE_WARMUP_RX.conditioning!), durationSeconds: BIKE_WARMUP_RX.durationSeconds! };
  }
  const shape = pieceShape(last);
  const same = history.filter((set) => pieceShape(set) === shape).map(conditioningOf);
  const target = rollForward(same, targetOf(conditioningOf(last)));
  return {
    target,
    durationSeconds: pieceSeconds({ conditioning: target, durationSeconds: last.durationSeconds }),
  };
}

/** A routine that lifts: not care/core work, and at least one strength row
 *  that isn't trunk work (mobility, bike-only and ab-only routines don't). */
export function isLiftingRoutine(data: GymData, routineId: string): boolean {
  const routine = data.routineById.get(routineId);
  if (!routine || isFinisherRoutine(routine)) return false;
  return (data.exercisesByRoutine.get(routineId) ?? []).some((rx) => {
    const pattern = data.exerciseById.get(rx.exerciseId)?.pattern;
    return isStrengthPattern(pattern) && pattern !== "core";
  });
}

/** Whether starting this routine should open with the bike warm-up: a
 *  lifting routine that doesn't already start on a bike row, in a catalog
 *  that still has the Echo Bike. */
export function wantsBikeWarmup(data: GymData, routineId: string): boolean {
  if (!isLiftingRoutine(data, routineId)) return false;
  const first = [...(data.exercisesByRoutine.get(routineId) ?? [])].sort((a, b) => a.order - b.order)[0];
  if (first && data.exerciseById.get(first.exerciseId)?.pattern === "conditioning") return false;
  return (
    data.exerciseById.get(BIKE_WARMUP_RX.exerciseId)?.pattern === "conditioning" &&
    variantOf(data, BIKE_WARMUP_RX) !== undefined
  );
}

/** The bike warm-up set. Bike rows have no "make warm-up" toggle, so a
 *  warm-up Echo Bike set only ever comes from this feature. */
export function isBikeWarmupSet(set: Pick<SetLog, "exerciseId" | "modalityId" | "isWarmup">): boolean {
  return (
    set.isWarmup &&
    set.exerciseId === BIKE_WARMUP_RX.exerciseId &&
    set.modalityId === BIKE_WARMUP_RX.modalityId
  );
}

/** A block made only of bike warm-up sets (a squat set toggled to warm-up
 *  is still a squat block). */
export function isBikeWarmupBlock(block: {
  sets: readonly Pick<SetLog, "exerciseId" | "modalityId" | "isWarmup">[];
}): boolean {
  return block.sets.length > 0 && block.sets.every(isBikeWarmupSet);
}

/** The session list Finish saves: an unlogged bike warm-up is a warm-up
 *  that didn't happen, so it's dropped rather than kept as a skipped row
 *  (a skipped lift stays — that's a record of what was planned). Same array
 *  when there's nothing to drop; the caller renumbers. */
export function dropUnloggedBikeWarmups<T extends Pick<SetLog, "exerciseId" | "modalityId" | "isWarmup" | "completed">>(
  sets: T[],
): T[] {
  const kept = sets.filter((s) => s.completed || !isBikeWarmupSet(s));
  return kept.length === sets.length ? sets : kept;
}
