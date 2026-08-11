import type { ExerciseId, ModalityId, RoutineExercise } from "../types";

/** Seed routine-row builder shared by the training fixtures (programs.ts)
 *  and the Care routines. Defaults mirror a plain strength row: 3 sets,
 *  90s rest, bilateral, no band/superset/notes. */
export function re(
  routineId: string,
  order: number,
  exerciseId: ExerciseId,
  modalityId: ModalityId,
  o: Partial<Omit<RoutineExercise, "routineId" | "order" | "exerciseId" | "modalityId">>,
): RoutineExercise {
  return {
    routineId,
    order,
    exerciseId,
    modalityId,
    bandRole: null,
    unilateralMode: "bilateral",
    sets: 3,
    repMin: null,
    repMax: null,
    durationSeconds: null,
    restSeconds: 90,
    targetRir: null,
    supersetGroup: null,
    notes: "",
    ...o,
  };
}
