import type { GymData } from "./gym-data";
import { newId } from "./ids";
import { suggestedLoad } from "./queries";
import type { ClientId, Session, SetLog } from "./types";

/**
 * Build a planned session from a routine: one editable SetLog per prescribed
 * set, prefilled with the client's most recent load for each variant. Pure —
 * the solo and group start actions both insert what this returns.
 */
export function plannedSessionFromRoutine(
  data: GymData,
  clientId: ClientId,
  routineId: string,
  assignmentId: string | null,
  date: string,
): { session: Session; sets: SetLog[] } {
  const prescriptions = data.exercisesByRoutine.get(routineId) ?? [];
  if (prescriptions.length === 0) throw new Error("Routine has no exercises.");

  const session: Session = {
    id: newId("s"),
    clientId,
    date,
    assignmentId,
    routineId,
    durationMinutes: null,
    rpe: null,
    condition: null,
    status: "planned",
    notes: "",
  };

  const sets: SetLog[] = [];
  for (const rx of prescriptions) {
    const prefill = suggestedLoad(data, clientId, rx.exerciseId, rx.modalityId);
    for (let i = 0; i < rx.sets; i++) {
      sets.push({
        id: newId("sl"),
        sessionId: session.id,
        exerciseId: rx.exerciseId,
        modalityId: rx.modalityId,
        position: sets.length + 1,
        setNumber: i + 1,
        unilateralMode: rx.unilateralMode,
        side: null,
        reps: rx.durationSeconds !== null ? null : rx.repMax ?? rx.repMin,
        weightLbs: prefill?.weightLbs ?? null,
        addedWeightLbs: prefill?.addedWeightLbs ?? null,
        bandId: prefill?.bandId ?? null,
        bandRole: prefill?.bandRole ?? rx.bandRole,
        durationSeconds: rx.durationSeconds,
        distanceFeet: null,
        rir: null,
        isWarmup: false,
        completed: false,
        notes: "",
      });
    }
  }

  return { session, sets };
}

export function localToday(): string {
  return new Date().toLocaleDateString("en-CA"); // YYYY-MM-DD in server-local time
}
