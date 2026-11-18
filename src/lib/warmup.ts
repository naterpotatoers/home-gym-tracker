import { isFinisherRoutine } from "./built-in-routines";
import { EMPTY_TARGET } from "./conditioning";
import { re } from "./data/routine-builder";
import { isStrengthPattern } from "./exercise-catalog";
import type { GymData } from "./gym-data";
import { variantOf } from "./modality";
import type { RoutineExercise, SetLog } from "./types";

/**
 * The default Echo Bike warm-up: 5 easy minutes before every lifting session
 * (skippable per start from the launcher). It's a real conditioning SetLog
 * flagged isWarmup, so every strength and conditioning number already
 * ignores it (workingSets drops warm-ups); this synthetic prescription gives
 * the runner its rx line and rest. Not a routine row — routines stay as
 * authored.
 */
/** The warm-up's length and effort — every label that describes it (the
 *  launcher's checkbox, the runner's rx line, the bike row) reads these. */
export const WARMUP_MINUTES = 5;
export const WARMUP_EFFORT = "RPE 3–4";

export const BIKE_WARMUP_RX: RoutineExercise = re("__warmup", 0, "echo_bike", "cardio", {
  sets: 1,
  durationSeconds: WARMUP_MINUTES * 60,
  restSeconds: 60,
  notes: `Easy, ${WARMUP_EFFORT} — conversational pace.`,
  conditioning: EMPTY_TARGET,
});

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
