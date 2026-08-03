import { dumbbells } from "./data/equipment";
import type { GymData } from "./gym-data";
import { newId } from "./ids";
import { nearestLoadableWeight } from "./loading";
import { bestE1rm, effectiveLoadFactor, latestBodyweight } from "./modality";
import { latestSet, suggestedLoad, weightForReps, workingSets } from "./queries";
import type {
  ClientId,
  ModalityId,
  RoutineExercise,
  Session,
  SetLog,
} from "./types";

type Prefill = Pick<SetLog, "weightLbs" | "addedWeightLbs" | "bandId" | "bandRole">;

/** Snap a predicted TOTAL load to what the equipment can actually build, in
 *  the SetLog's own field semantics (weightLbs is per implement). Null when
 *  the modality can't honestly take a predicted pound value. */
function roundedPrefill(
  data: GymData,
  clientId: ClientId,
  rx: RoutineExercise,
  totalLbs: number,
  date: string,
): Prefill | null {
  const empty = { weightLbs: null, addedWeightLbs: null, bandId: null, bandRole: rx.bandRole };
  switch (rx.modalityId) {
    case "barbell": {
      const w = nearestLoadableWeight(totalLbs);
      return w === null ? null : { ...empty, weightLbs: w };
    }
    case "dumbbell": {
      const implementsPerRep = rx.unilateralMode === "single_side" ? 1 : 2;
      const per = totalLbs / implementsPerRep;
      const owned = dumbbells.map((d) => d.weightLbs);
      if (owned.length === 0) return null;
      const nearest = owned.reduce((a, b) =>
        Math.abs(b - per) < Math.abs(a - per) || (Math.abs(b - per) === Math.abs(a - per) && b < a)
          ? b
          : a,
      );
      return { ...empty, weightLbs: nearest };
    }
    case "machine":
      return { ...empty, weightLbs: Math.max(5, Math.round(totalLbs / 5) * 5) };
    case "bodyweight": {
      const bw = latestBodyweight(data, clientId, date);
      if (bw === null) return null;
      const added = Math.max(0, Math.round((totalLbs - bw) / 2.5) * 2.5);
      return { ...empty, addedWeightLbs: added > 0 ? added : null };
    }
    case "band":
      // Ordinal territory — never fabricate a pound value for a band.
      return null;
  }
}

/**
 * The prefill for a prescription, most-honest first:
 * 1. the most recent working set AT the prescribed rep range (verbatim fields
 *    — covers bands naturally);
 * 2. else this variant's best e1RM, re-targeted to the prescribed reps;
 * 3. else a cross-modality transfer: same exercise, most recently trained
 *    other modality, converted through the load-factor model;
 * 4. else blank — a lift with no basis anywhere gets no number.
 */
export function smartPrefill(
  data: GymData,
  clientId: ClientId,
  rx: RoutineExercise,
  date: string,
): Prefill | null {
  const targetReps = rx.repMax ?? rx.repMin ?? 10;
  const lo = rx.repMin ?? targetReps - 2;
  const hi = rx.repMax ?? targetReps + 2;

  const own = workingSets(data, clientId, rx.exerciseId, rx.modalityId);

  // 1. Most recent set inside the prescribed rep range.
  const inRange = latestSet(
    data,
    own.filter((set) => set.reps !== null && set.reps >= lo && set.reps <= hi),
  );
  if (inRange) {
    return {
      weightLbs: inRange.weightLbs,
      addedWeightLbs: inRange.addedWeightLbs,
      bandId: inRange.bandId,
      bandRole: inRange.bandRole,
    };
  }

  // 2. Any history in this modality: re-target its best e1RM to the
  //    prescribed reps. Band-only history has no e1RM — reuse the last set.
  if (own.length > 0) {
    const e1rm = bestE1rm(data, own);
    if (e1rm !== null) {
      const predicted = roundedPrefill(
        data, clientId, rx, weightForReps(e1rm, targetReps), date,
      );
      if (predicted) return predicted;
    }
    return suggestedLoad(data, clientId, rx.exerciseId, rx.modalityId);
  }

  // 3. Cross-modality transfer — never INTO band work (ordinal).
  if (rx.modalityId === "band") return null;
  const byModality = new Map<ModalityId, SetLog[]>();
  for (const set of workingSets(data, clientId, rx.exerciseId)) {
    if (set.modalityId === rx.modalityId) continue;
    const existing = byModality.get(set.modalityId);
    if (existing) existing.push(set);
    else byModality.set(set.modalityId, [set]);
  }
  let source: { e1rm: number; factor: number; lastDate: string } | null = null;
  for (const [modalityId, sets] of byModality) {
    const e1rm = bestE1rm(data, sets);
    if (e1rm === null) continue;
    const factor = effectiveLoadFactor(data, clientId, rx.exerciseId, modalityId).factor;
    if (!factor) continue;
    const lastDate = sets.reduce((max, s) => {
      const d = data.sessionById.get(s.sessionId)?.date ?? "";
      return d > max ? d : max;
    }, "");
    if (!source || lastDate > source.lastDate) source = { e1rm, factor, lastDate };
  }
  if (source) {
    const targetFactor = effectiveLoadFactor(data, clientId, rx.exerciseId, rx.modalityId).factor;
    if (targetFactor) {
      const targetE1rm = (source.e1rm / source.factor) * targetFactor;
      return roundedPrefill(
        data, clientId, rx, weightForReps(targetE1rm, targetReps), date,
      );
    }
  }

  return null;
}

/**
 * Build a planned session from a routine: one editable SetLog per prescribed
 * set, prefilled via `smartPrefill`. Pure — the solo and group start actions
 * both insert what this returns.
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
    const prefill = smartPrefill(data, clientId, rx, date);
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
