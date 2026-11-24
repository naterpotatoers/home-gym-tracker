import {
  conditioningTarget,
  EMPTY_CONDITIONING,
  EMPTY_TARGET,
  pieceSeconds,
} from "./conditioning";
import { ankleWeights, dumbbells } from "./data/equipment";
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
import { topOfLatestSession } from "./queries";
import { BIKE_WARMUP_RX, wantsBikeWarmup, warmupPlan } from "./warmup";
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

type Prefill = Pick<SetLog, "weightLbs" | "addedWeightLbs" | "bandId" | "bandRole"> & {
  /** Set when the load was just bumped — reps restart at the bottom of the
   *  range. Absent: the prescription's top rep. */
  reps?: number;
};

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
      const nearest = nearestOwned(dumbbells.map((d) => d.weightLbs), per);
      return nearest === null ? null : { ...empty, weightLbs: nearest };
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
    case "ankle_weight":
      // No e1RM or load factor ever reaches here (fixed-weight lever work);
      // snap to an owned pair anyway so the switch stays total.
      return { ...empty, weightLbs: nearestOwned(ankleWeights.map((a) => a.weightLbs), totalLbs) };
  }
}

/** The owned weight closest to `lbs` (the lighter one on a tie). */
function nearestOwned(owned: readonly number[], lbs: number): number | null {
  if (owned.length === 0) return null;
  return owned.reduce((a, b) =>
    Math.abs(b - lbs) < Math.abs(a - lbs) || (Math.abs(b - lbs) === Math.abs(a - lbs) && b < a) ? b : a,
  );
}

/**
 * The prefill for a prescription, most-honest first:
 * 1. last time's load — the top working set (topOfLatestSession; bands:
 *    that session's band) of, in order: the latest session of THIS routine
 *    with the variant ("last time on this day" — survives a rep-range edit
 *    and never mixes a heavy day into a volume day, however long ago), else
 *    the latest session at the prescribed rep range, else the latest
 *    session at all. Never an automatic bump or an e1RM re-target — the
 *    lifter decides when to go heavier (the runner only flags a stall);
 * 2. else a cross-modality transfer: same exercise, most recently trained
 *    other modality, converted through the load-factor model;
 * 3. else blank — a lift with no basis anywhere gets no number. Except
 *    ankle-weight work: the pair you own IS the load, so it starts on the
 *    lightest one.
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

  // 1. Last time's load (see above).
  const sameRoutine = own.filter((set) => data.sessionById.get(set.sessionId)?.routineId === rx.routineId);
  const inRange = own.filter((set) => set.reps !== null && set.reps >= lo && set.reps <= hi);
  for (const pool of [sameRoutine, inRange, own]) {
    if (pool.length > 0) return topOfLatestSession(data, pool);
  }

  // 2. Cross-modality transfer — never INTO band work (ordinal).
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

  if (rx.modalityId === "ankle_weight") {
    const lightest = Math.min(...ankleWeights.map((a) => a.weightLbs));
    if (Number.isFinite(lightest)) {
      return { weightLbs: lightest, addedWeightLbs: null, bandId: null, bandRole: rx.bandRole };
    }
  }
  return null;
}

/**
 * Build a planned session from a routine: one editable SetLog per prescribed
 * set, prefilled via `smartPrefill`. With `bikeWarmup`, a lifting routine
 * opens with the Echo Bike warm-up (BIKE_WARMUP_RX, flagged isWarmup),
 * picked up from the person's last one (warmupPlan). Pure — the start action inserts what this returns. Throws on a
 * missing routine or an assignment that isn't this person's (ids arrive
 * from forms).
 */
export function plannedSessionFromRoutine(
  data: GymData,
  clientId: ClientId,
  routineId: string,
  assignmentId: string | null,
  date: string,
  { bikeWarmup = false }: { bikeWarmup?: boolean } = {},
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

  const withWarmup = bikeWarmup && wantsBikeWarmup(data, routineId);
  const rows = withWarmup ? [BIKE_WARMUP_RX, ...prescriptions] : prescriptions;
  // The warm-up picks up from this person's last warm-up — never from their
  // finisher pieces' targets.
  const warm = withWarmup ? warmupPlan(data, clientId) : null;
  const sets: SetLog[] = [];
  for (const rx of rows) {
    const warmup = rx === BIKE_WARMUP_RX;
    // A bike piece: the person's own target, no pounds, timed by the piece.
    const conditioning = warmup && warm
      ? { ...EMPTY_CONDITIONING, ...warm.target }
      : data.exerciseById.get(rx.exerciseId)?.pattern === "conditioning"
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
        reps: conditioning || rx.durationSeconds !== null ? null : prefill?.reps ?? rx.repMax ?? rx.repMin,
        weightLbs: prefill?.weightLbs ?? null,
        addedWeightLbs: prefill?.addedWeightLbs ?? null,
        bandId: prefill?.bandId ?? null,
        bandRole: prefill?.bandRole ?? rx.bandRole,
        durationSeconds: warmup && warm ? warm.durationSeconds : conditioning ? pieceSeconds(rx) : rx.durationSeconds,
        distanceFeet: null,
        rir: null,
        isWarmup: warmup,
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
