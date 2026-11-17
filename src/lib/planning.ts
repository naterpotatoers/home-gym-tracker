import {
  conditioningTarget,
  EMPTY_CONDITIONING,
  EMPTY_TARGET,
  pieceSeconds,
} from "./conditioning";
import { dumbbells } from "./data/equipment";
import { groupBy } from "./exercise-catalog";
import { activeAssignment, type GymData } from "./gym-data";
import { newId } from "./ids";
import { nearestLoadableWeight, weightStep } from "./loading";
import {
  bestE1rm,
  effectiveLoadFactor,
  implementsPerRep,
  latestBodyweight,
  variantOf,
  weightForReps,
  workingSets,
} from "./modality";
import { latestSet, suggestedLoad } from "./queries";
import { addDaysIso, currentProgramWeek, isoDow, programEnded } from "./periods";
import type {
  Assignment,
  ClientId,
  Program,
  RoutineExercise,
  Session,
  SetLog,
} from "./types";

/** Round to the nearest multiple of `step`. */
function roundTo(lbs: number, step: number): number {
  return Math.round(lbs / step) * step;
}

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
      // Same load shape setLoad reads back: a dumbbell-weighted pull-up's
      // total includes the lifter, and a goblet squat moves one implement.
      let dumbbellLbs = totalLbs;
      if (variantOf(data, rx)?.loadIncludesBodyweight) {
        const bw = latestBodyweight(data, clientId, date);
        if (bw === null) return null;
        dumbbellLbs = totalLbs - bw;
        if (dumbbellLbs <= 0) return null;
      }
      const per = dumbbellLbs / implementsPerRep(data, rx);
      const owned = dumbbells.map((d) => d.weightLbs);
      if (owned.length === 0) return null;
      const nearest = owned.reduce((a, b) =>
        Math.abs(b - per) < Math.abs(a - per) || (Math.abs(b - per) === Math.abs(a - per) && b < a)
          ? b
          : a,
      );
      return { ...empty, weightLbs: nearest };
    }
    case "machine": {
      const step = weightStep("machine")!;
      return { ...empty, weightLbs: Math.max(step, roundTo(totalLbs, step)) };
    }
    case "bodyweight": {
      const bw = latestBodyweight(data, clientId, date);
      if (bw === null) return null;
      const added = Math.max(0, roundTo(totalLbs - bw, weightStep("bodyweight")!));
      return { ...empty, addedWeightLbs: added > 0 ? added : null };
    }
    case "band":
      // Ordinal territory — never fabricate a pound value for a band.
      return null;
    case "cardio":
      // Watts and RPM, never pounds (conditioningTarget handles these).
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
  const byModality = groupBy(
    workingSets(data, clientId, rx.exerciseId).filter((set) => set.modalityId !== rx.modalityId),
    (set) => set.modalityId,
  );
  let source: { e1rm: number; factor: number; lastDate: string } | null = null;
  for (const [modalityId, sets] of byModality) {
    const e1rm = bestE1rm(data, sets);
    if (e1rm === null) continue;
    // Null = not comparable to a bar (unmeasured bodyweight/band): a
    // bodyweight squat's e1RM says nothing about the barbell.
    const factor = effectiveLoadFactor(data, clientId, rx.exerciseId, modalityId).factor;
    if (factor === null || factor <= 0) continue;
    const lastDate = sets.reduce((max, s) => {
      const d = data.sessionById.get(s.sessionId)?.date ?? "";
      return d > max ? d : max;
    }, "");
    if (!source || lastDate > source.lastDate) source = { e1rm, factor, lastDate };
  }
  if (source) {
    const targetFactor = effectiveLoadFactor(data, clientId, rx.exerciseId, rx.modalityId).factor;
    if (targetFactor !== null && targetFactor > 0) {
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
 * both insert what this returns. Throws on a missing routine or an
 * assignment that isn't this person's (ids arrive from forms).
 */
export function plannedSessionFromRoutine(
  data: GymData,
  clientId: ClientId,
  routineId: string,
  assignmentId: string | null,
  date: string,
): { session: Session; sets: SetLog[] } {
  if (!data.routineById.has(routineId)) throw new Error("That routine no longer exists.");
  if (assignmentId !== null && data.assignments.find((a) => a.id === assignmentId)?.clientId !== clientId) {
    throw new Error(`bad assignment ${assignmentId}`);
  }
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
    // A bike piece: the person's own target, no pounds, timed by the piece.
    const conditioning =
      data.exerciseById.get(rx.exerciseId)?.pattern === "conditioning"
        ? { ...EMPTY_CONDITIONING, ...conditioningTarget(data, clientId, rx.exerciseId, rx.conditioning ?? EMPTY_TARGET) }
        : null;
    const prefill = conditioning ? null : smartPrefill(data, clientId, rx, date);
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
        reps: conditioning || rx.durationSeconds !== null ? null : rx.repMax ?? rx.repMin,
        weightLbs: prefill?.weightLbs ?? null,
        addedWeightLbs: prefill?.addedWeightLbs ?? null,
        bandId: prefill?.bandId ?? null,
        bandRole: prefill?.bandRole ?? rx.bandRole,
        durationSeconds: conditioning ? pieceSeconds(rx) : rx.durationSeconds,
        distanceFeet: null,
        rir: null,
        isWarmup: false,
        completed: false,
        notes: "",
        conditioning,
      });
    }
  }

  return { session, sets };
}

export type ProgramWeekDay = {
  dayOfWeek: number;
  /** The calendar date this program day lands on in the current week. */
  date: string;
  routineId: string;
  done: boolean;
  isToday: boolean;
};

export type ProgramWeekStatus = {
  assignment: Assignment;
  program: Program;
  week: number;
  /** Today is past the program's last week — nothing more is scheduled. */
  finished: boolean;
  days: ProgramWeekDay[];
};

/**
 * A person's active program as of `todayIso`: which week it is and which of
 * that week's days are done. Completed sessions match scheduled days
 * one-to-one, in date order, so a single Lower session can't tick both Lower
 * days. Weeks count from the assignment's start date, not from Monday.
 */
export function programWeekStatus(
  data: GymData,
  clientId: ClientId,
  todayIso: string,
): ProgramWeekStatus | null {
  const assignment = activeAssignment(data, clientId);
  const program = assignment ? data.programById.get(assignment.programId) : undefined;
  if (!assignment || !program) return null;

  const week = currentProgramWeek(assignment, program, todayIso);
  const finished = programEnded(assignment, program, todayIso);
  const weekStart = addDaysIso(assignment.startDate, (week - 1) * 7);
  const weekEnd = addDaysIso(assignment.startDate, week * 7);

  const unmatched = data.sessions
    .filter(
      (s) =>
        s.clientId === clientId &&
        s.status === "completed" &&
        s.date >= weekStart &&
        s.date < weekEnd,
    )
    .sort((a, b) => a.date.localeCompare(b.date));

  const days = data.programDays
    .filter((d) => d.programId === program.id && d.week === week)
    .map((day) => ({
      day,
      date: addDaysIso(weekStart, (day.dayOfWeek - isoDow(weekStart) + 7) % 7),
    }))
    .sort((a, b) => a.date.localeCompare(b.date))
    .map(({ day, date }) => {
      const at = unmatched.findIndex((s) => s.routineId === day.routineId);
      if (at >= 0) unmatched.splice(at, 1);
      return {
        dayOfWeek: day.dayOfWeek,
        date,
        routineId: day.routineId,
        done: at >= 0,
        isToday: date === todayIso,
      };
    });

  return { assignment, program, week, finished, days };
}
