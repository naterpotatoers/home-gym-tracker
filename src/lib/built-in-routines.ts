import { careRoutineExercises, careRoutines, isCareRoutine } from "./data/care-routines";
import { coreRoutineExercises, coreRoutines, isCoreRoutine } from "./data/core-routines";
import { groupBy } from "./exercise-catalog";
import type { GymData } from "./gym-data";
import type { Routine, RoutineExercise } from "./types";

/** The app-owned finisher routines (Care + Core), in seed order. */
export const builtInRoutines: readonly Routine[] = [...careRoutines, ...coreRoutines];
export const builtInRoutineRows: readonly RoutineExercise[] = [
  ...careRoutineExercises,
  ...coreRoutineExercises,
];

export function builtInRowsFor(routineId: string): RoutineExercise[] {
  return builtInRoutineRows
    .filter((row) => row.routineId === routineId)
    .sort((a, b) => a.order - b.order);
}

/** Care or core work — offered as a finisher, kept out of "Other routines". */
export function isFinisherRoutine(routine: Pick<Routine, "id" | "name">): boolean {
  return isCareRoutine(routine) || isCoreRoutine(routine);
}

/** Everything a routine row prescribes — the fields that make two rows the
 *  same prescription (routineId/order are positional, compared by index). */
function rowSignature(row: RoutineExercise): string {
  return JSON.stringify([
    row.exerciseId,
    row.modalityId,
    row.bandRole,
    row.unilateralMode,
    row.sets,
    row.repMin,
    row.repMax,
    row.durationSeconds,
    row.restSeconds,
    row.targetRir,
    row.supersetGroup,
    row.notes,
    row.conditioning
      ? [row.conditioning.intervalScheme, row.conditioning.targetWatts, row.conditioning.targetRpm]
      : null,
  ]);
}

export type BuiltInDrift = {
  /** Built-ins the database doesn't have yet. */
  missing: Routine[];
  /** Built-ins present but no longer matching the shipped version (name,
   *  notes, or any row) — older shipped versions or hand edits. */
  changed: Routine[];
};

/** Which built-in finisher routines need adding or updating in `data` (the
 *  snapshot, or just the built-ins' routines + rows fetched by an action). */
export function builtInRoutineDrift(
  data: Pick<GymData, "routineById" | "exercisesByRoutine">,
): BuiltInDrift {
  const missing: Routine[] = [];
  const changed: Routine[] = [];
  for (const routine of builtInRoutines) {
    const live = data.routineById.get(routine.id);
    if (!live) {
      missing.push(routine);
      continue;
    }
    const want = builtInRowsFor(routine.id).map(rowSignature);
    const have = [...(data.exercisesByRoutine.get(routine.id) ?? [])]
      .sort((a, b) => a.order - b.order)
      .map(rowSignature);
    const same =
      live.name === routine.name &&
      live.notes === routine.notes &&
      want.length === have.length &&
      want.every((sig, i) => sig === have[i]);
    if (!same) changed.push(routine);
  }
  return { missing, changed };
}

/** builtInRoutineDrift over plain rows — what an action fetches (just the
 *  built-ins' routines and their rows, already mapped). */
export function builtInDriftFromRows(
  routines: readonly Routine[],
  rows: readonly RoutineExercise[],
): BuiltInDrift {
  return builtInRoutineDrift({
    routineById: new Map(routines.map((routine) => [routine.id, routine])),
    exercisesByRoutine: groupBy(rows, (row) => row.routineId),
  });
}
