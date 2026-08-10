import {
  hipBandRank,
  hipBandsByDifficulty,
  ownedEquipmentIds,
} from "./data/equipment";
import { modalityById } from "./data/modalities";
import { muscles } from "./data/muscles";
import { exerciseLookup, type ExerciseCatalog } from "./exercise-catalog";
import type { GymData } from "./gym-data";
import { nearestLoadableWeight } from "./loading";
import { currentProgramWeek, localIso, localTodayIso } from "./periods";
import { toBlocks, type Block } from "./set-blocks";
import {
  bestE1rm,
  e1rm,
  effectiveScores,
  latestBodyweight,
  normalizedLoad,
  setLoad,
  sidesWorked,
} from "./modality";
import type {
  BandRole,
  Client,
  ClientId,
  EquipmentId,
  Exercise,
  ExerciseId,
  ExerciseModality,
  HipBand,
  ModalityId,
  MuscleId,
  Session,
  SetLog,
} from "./types";

// ---------------------------------------------------------------------------
// People
// ---------------------------------------------------------------------------

/** Age from date of birth, so it never goes stale. */
function ageOn(dateOfBirth: string, asOf: Date = new Date()): number {
  const dob = new Date(`${dateOfBirth}T00:00:00`);
  let age = asOf.getFullYear() - dob.getFullYear();
  const monthDiff = asOf.getMonth() - dob.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && asOf.getDate() < dob.getDate())) age--;
  return age;
}

/** The roster's first client — the fallback wherever a page needs SOME
 *  client and the URL didn't name one. Never hardcode a client id: they're
 *  DB rows now and any given roster may lack it. */
export function defaultClientId(data: GymData): string {
  return data.clients[0]?.id ?? "";
}

export type ClientSummary = {
  client: Client;
  age: number;
  bodyweightLbs: number | null;
  bodyweightChangeLbs: number | null;
  sessionCount: number;
  lastSessionDate: string | null;
};

export function clientSummaries(data: GymData, asOf: Date = new Date()): ClientSummary[] {
  const isoToday = localIso(asOf);
  return data.clients.map((client) => {
    const mine = data.sessions
      .filter((s) => s.clientId === client.id && s.status === "completed")
      .sort((a, b) => a.date.localeCompare(b.date));
    const current = latestBodyweight(data, client.id, isoToday);
    const atJoin = latestBodyweight(data, client.id, client.joinDate);
    return {
      client,
      age: ageOn(client.dateOfBirth, asOf),
      bodyweightLbs: current,
      bodyweightChangeLbs:
        current !== null && atJoin !== null && atJoin !== current
          ? current - atJoin
          : null,
      sessionCount: mine.length,
      lastSessionDate: mine.at(-1)?.date ?? null,
    };
  });
}

// ---------------------------------------------------------------------------
// Sessions
// ---------------------------------------------------------------------------

export function sessionsFor(data: GymData, clientId: ClientId): Session[] {
  return data.sessions
    .filter((s) => s.clientId === clientId)
    .sort((a, b) => b.date.localeCompare(a.date));
}

/** ≥2 unfinished sessions sharing a date were (probably) a group workout —
 *  the shared board is otherwise unreachable once you navigate away, so the
 *  home and workout pages both offer it back. Newest date first. */
export function openBoardGroups(
  data: GymData,
): { date: string; sessionIds: string[] }[] {
  const byDate = new Map<string, string[]>();
  for (const s of data.sessions) {
    if (s.status !== "planned") continue;
    const ids = byDate.get(s.date);
    if (ids) ids.push(s.id);
    else byDate.set(s.date, [s.id]);
  }
  return [...byDate]
    .filter(([, ids]) => ids.length >= 2)
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([date, sessionIds]) => ({ date, sessionIds }));
}

function setsFor(data: GymData, sessionId: string): SetLog[] {
  return [...(data.setsBySession.get(sessionId) ?? [])];
}

/** Sets grouped into the exercise × modality blocks they were performed in,
 *  preserving order — so a mid-session implement switch reads as two blocks.
 *  One algorithm: this IS `toBlocks`, applied to a session's sets. */
export type SetBlock = Block;

export function blocksFor(data: GymData, sessionId: string): SetBlock[] {
  return toBlocks(setsFor(data, sessionId));
}

/** Total honest pounds moved in a session's completed working sets. Warmups
 *  and ordinal (band-rank) work stay out — no fake numbers in a lbs total. */
export function sessionVolumeLbs(data: GymData, sessionId: string): number {
  return setsFor(data, sessionId)
    .filter((s) => s.completed && !s.isWarmup)
    .reduce((sum, set) => {
      const load = setLoad(data, set);
      return load.lbs === null ? sum : sum + load.lbs * load.totalReps;
    }, 0);
}

/** One-line description of a set, in the units that set was actually measured
 *  in. Ordinal loads render as a band name, never as a number. */
export function describeSet(data: GymData, set: SetLog): string {
  const load = setLoad(data, set);
  const parts: string[] = [];

  if (set.durationSeconds !== null) parts.push(`${set.durationSeconds}s`);
  if (set.distanceFeet !== null) parts.push(`${set.distanceFeet} ft`);
  if (set.reps !== null) {
    parts.push(sidesWorked(set) > 1 ? `${set.reps} × ${sidesWorked(set)} sides` : `${set.reps} reps`);
  }

  if (set.modalityId === "dumbbell" && set.weightLbs !== null) {
    parts.push(`${set.weightLbs} lb ea (${load.lbs} total)`);
  } else if (load.precision === "ordinal") {
    parts.push(`${bandLabel(set)} band`);
  } else if (set.bandRole === "assistance") {
    parts.push(`−${bandLabel(set)} band assist`);
  } else if (set.bandId) {
    parts.push(`${bandLabel(set)} band`);
  } else if (set.weightLbs !== null) {
    parts.push(`${set.weightLbs} lb`);
  }

  if (set.rir !== null) parts.push(set.rir === 0 ? "to failure" : `RIR ${set.rir}`);
  return parts.join(" · ");
}

/** Short band name for labels — "blue", "small". Exported so cards and
 *  describeSet render bands identically. */
export function bandLabel(set: SetLog): string {
  return set.bandId?.replace(/^(band|hip_band)_/, "").replace(/_/g, "/") ?? "";
}

// ---------------------------------------------------------------------------
// Strength
// ---------------------------------------------------------------------------


/** Most recent set by (session date, position) — the shared recency rule. */
export function latestSet(data: GymData, sets: readonly SetLog[]): SetLog | null {
  let latest: SetLog | null = null;
  let latestDate = "";
  for (const set of sets) {
    const date = data.sessionById.get(set.sessionId)?.date ?? "";
    if (
      !latest ||
      date > latestDate ||
      (date === latestDate && set.position > latest.position)
    ) {
      latest = set;
      latestDate = date;
    }
  }
  return latest;
}

/** Completed working sets for one client × variant. The shared filter behind
 *  every strength stat, so "counts toward a PR" means one thing. */
export function workingSets(
  data: GymData,
  clientId: ClientId,
  exerciseId?: ExerciseId,
  modalityId?: ModalityId,
): SetLog[] {
  return data.setLogs.filter((set) => {
    if (exerciseId && set.exerciseId !== exerciseId) return false;
    if (modalityId && set.modalityId !== modalityId) return false;
    if (set.isWarmup || !set.completed) return false;
    return data.sessionById.get(set.sessionId)?.clientId === clientId;
  });
}

/** e1RM relative to the most recent weigh-in — needs weigh-in history, which
 *  is why bodyweight does not live on the profile. */
function relativeStrength(
  data: GymData,
  clientId: ClientId,
  exerciseId: ExerciseId,
  modalityId: ModalityId,
): number | null {
  const best = bestE1rm(data, workingSets(data, clientId, exerciseId, modalityId));
  const bodyweight = latestBodyweight(data, clientId, localTodayIso());
  if (best === null || bodyweight === null || bodyweight <= 0) return null;
  return best / bodyweight;
}

// ---------------------------------------------------------------------------
// Metrics explorations
// ---------------------------------------------------------------------------

/** Epley inverted: the weight that lands `reps` at this e1RM. Total pounds per
 *  rep, same basis as e1RM itself. */
export function weightForReps(e1rmLbs: number, reps: number): number {
  return e1rmLbs / (1 + reps / 30);
}

/** Epley inverted the other way: reps expected at `weightLbs` given this e1RM. */
export function repsForWeight(e1rmLbs: number, weightLbs: number): number {
  if (weightLbs <= 0) return 0;
  return Math.max(0, 30 * (e1rmLbs / weightLbs - 1));
}

/** Every exercise × modality anyone has actually trained — the picker list for
 *  the metrics explorer. */
export type TrainedVariant = {
  exerciseId: ExerciseId;
  modalityId: ModalityId;
  clients: ClientId[];
  lastDate: string;
};

export function trainedVariants(data: GymData): TrainedVariant[] {
  const byKey = new Map<string, TrainedVariant & { clientSet: Set<ClientId> }>();
  for (const set of data.setLogs) {
    if (set.isWarmup || !set.completed) continue;
    const session = data.sessionById.get(set.sessionId);
    if (!session) continue;
    const key = `${set.exerciseId}|${set.modalityId}`;
    let row = byKey.get(key);
    if (!row) {
      row = {
        exerciseId: set.exerciseId,
        modalityId: set.modalityId,
        clients: [],
        lastDate: session.date,
        clientSet: new Set(),
      };
      byKey.set(key, row);
    }
    row.clientSet.add(session.clientId);
    if (session.date > row.lastDate) row.lastDate = session.date;
  }
  const { exerciseById } = exerciseLookup(data);
  return [...byKey.values()]
    .map(({ clientSet, ...row }) => ({ ...row, clients: [...clientSet] }))
    .sort(
      (a, b) =>
        (exerciseById.get(a.exerciseId)?.name ?? "").localeCompare(
          exerciseById.get(b.exerciseId)?.name ?? "",
        ) || a.modalityId.localeCompare(b.modalityId),
    );
}

/** Best e1RM for a variant BEFORE a given session — the recap compares the
 *  session's best against this to call out a PR honestly (the session's own
 *  sets must not count toward the bar they're being measured against). */
export function priorBestE1rm(
  data: GymData,
  clientId: ClientId,
  exerciseId: ExerciseId,
  modalityId: ModalityId,
  excludeSessionId: string,
  asOfDate: string,
): number | null {
  const sets = workingSets(data, clientId, exerciseId, modalityId).filter((s) => {
    if (s.sessionId === excludeSessionId) return false;
    const session = data.sessionById.get(s.sessionId);
    return !!session && session.status === "completed" && session.date <= asOfDate;
  });
  return bestE1rm(data, sets);
}

/** The most recently trained variants, as picker keys — pins a "Recent"
 *  group so mid-workout adds don't mean scrolling ~100 rows. No clientId =
 *  household-wide (the routine editor has no person in scope). */
export function recentVariantKeys(
  data: GymData,
  clientId?: ClientId,
  limit = 8,
): string[] {
  return trainedVariants(data)
    .filter((v) => (clientId ? v.clients.includes(clientId) : true))
    .sort((a, b) => b.lastDate.localeCompare(a.lastDate))
    .slice(0, limit)
    .map((v) => `${v.exerciseId}|${v.modalityId}`);
}

/**
 * "What should I put on the bar for 8-10s?" All numbers are TOTAL pounds per
 * rep (the e1RM basis) — the UI divides by two for per-implement dumbbell
 * display. Nulls, never fake numbers, for ordinal/unloaded work.
 */
export type RepRangeAnswer = {
  /** Heaviest completed set whose reps landed inside the range. */
  bestActual: { weightLbs: number; reps: number; date: string } | null;
  /** e1RM-predicted weight at the top of the range. */
  predicted: number | null;
  /** Nearest plate-buildable bar load to the prediction (barbell only). */
  suggestedBarLoad: number | null;
};

export function workingWeightForRepRange(
  data: GymData,
  clientId: ClientId,
  exerciseId: ExerciseId,
  modalityId: ModalityId,
  repMin: number,
  repMax: number,
): RepRangeAnswer {
  const sets = workingSets(data, clientId, exerciseId, modalityId);

  let bestActual: RepRangeAnswer["bestActual"] = null;
  for (const set of sets) {
    const load = setLoad(data, set);
    if (load.lbs === null || load.precision === "ordinal") continue;
    if (set.reps === null || set.reps < repMin || set.reps > repMax) continue;
    if (!bestActual || load.lbs > bestActual.weightLbs) {
      bestActual = {
        weightLbs: load.lbs,
        reps: set.reps,
        date: data.sessionById.get(set.sessionId)?.date ?? "",
      };
    }
  }

  const best = bestE1rm(data, sets);
  const predicted = best === null ? null : weightForReps(best, repMax);
  return {
    bestActual,
    predicted,
    suggestedBarLoad:
      predicted !== null && modalityId === "barbell"
        ? nearestLoadableWeight(predicted)
        : null,
  };
}

/** "How many reps should X pounds give me?" Same total-pounds basis. */
export type WeightAnswer = {
  /** Most reps ever completed at or above the asked weight. */
  bestActual: { reps: number; weightLbs: number; date: string } | null;
  predictedReps: number | null;
};

export function repRangeForWeight(
  data: GymData,
  clientId: ClientId,
  exerciseId: ExerciseId,
  modalityId: ModalityId,
  weightLbs: number,
): WeightAnswer {
  const sets = workingSets(data, clientId, exerciseId, modalityId);

  let bestActual: WeightAnswer["bestActual"] = null;
  for (const set of sets) {
    const load = setLoad(data, set);
    if (load.lbs === null || load.precision === "ordinal") continue;
    if (set.reps === null || load.lbs < weightLbs) continue;
    if (!bestActual || set.reps > bestActual.reps) {
      bestActual = {
        reps: set.reps,
        weightLbs: load.lbs,
        date: data.sessionById.get(set.sessionId)?.date ?? "",
      };
    }
  }

  const best = bestE1rm(data, sets);
  return {
    bestActual,
    predictedReps: best === null ? null : repsForWeight(best, weightLbs),
  };
}

/** One row per client for a cross-client comparison of a single variant. */
export type PrComparisonRow = {
  clientId: ClientId;
  bestE1rmLbs: number | null;
  heaviestLbs: number | null;
  /** e1RM ÷ latest bodyweight. */
  relative: number | null;
  date: string | null;
};

export function prComparison(
  data: GymData,
  exerciseId: ExerciseId,
  modalityId: ModalityId,
): PrComparisonRow[] {
  return data.clients.map((client) => {
    const sets = workingSets(data, client.id, exerciseId, modalityId);
    const best = bestE1rm(data, sets);
    if (best === null) {
      return { clientId: client.id, bestE1rmLbs: null, heaviestLbs: null, relative: null, date: null };
    }
    const bestSet = sets.reduce((a, b) =>
      (e1rm(data, b) ?? 0) > (e1rm(data, a) ?? 0) ? b : a,
    );
    return {
      clientId: client.id,
      bestE1rmLbs: best,
      heaviestLbs: Math.max(...sets.map((s) => setLoad(data, s).lbs ?? 0)),
      relative: relativeStrength(data, client.id, exerciseId, modalityId),
      date: data.sessionById.get(bestSet.sessionId)?.date ?? null,
    };
  });
}

/** Load fields of the most recent completed working set for a client ×
 *  variant — the prefill when a new session prescribes that variant. */
export function suggestedLoad(
  data: GymData,
  clientId: ClientId,
  exerciseId: ExerciseId,
  modalityId: ModalityId,
): Pick<SetLog, "weightLbs" | "addedWeightLbs" | "bandId" | "bandRole"> | null {
  const latest = latestSet(data, workingSets(data, clientId, exerciseId, modalityId));
  if (!latest) return null;
  return {
    weightLbs: latest.weightLbs,
    addedWeightLbs: latest.addedWeightLbs,
    bandId: latest.bandId,
    bandRole: latest.bandRole,
  };
}

// ---------------------------------------------------------------------------
// Volume
// ---------------------------------------------------------------------------

export type MuscleVolume = {
  muscleId: MuscleId;
  /** Score-weighted load × reps. Only from sets with a real load. */
  weightedVolumeLbs: number;
  /** Score-weighted reps from sets whose load has no magnitude (hip bands).
   *  Kept separate so ordinal work is visible without being faked as a number. */
  ordinalReps: number;
  sets: number;
  /** Highest effective score seen, i.e. how directly this muscle was trained. */
  peakScore: number;
};

/**
 * Per-muscle training volume over a date range.
 *
 * Two accumulators on purpose. A hip-band lateral walk genuinely trains glute
 * med, but there is no lb value to multiply, so folding it into a pounds total
 * would either drop it silently (looks like you skipped the work) or count it as
 * zero weight (same thing). It lands in `ordinalReps` instead.
 *
 * Mobility work contributes nothing — `effectiveScores` returns empty for it.
 */
export function muscleVolume(
  data: GymData,
  clientId: ClientId,
  opts: { from?: string; to?: string } = {},
): MuscleVolume[] {
  const totals = new Map<MuscleId, MuscleVolume>();
  for (const muscle of muscles) {
    totals.set(muscle.id, {
      muscleId: muscle.id,
      weightedVolumeLbs: 0,
      ordinalReps: 0,
      sets: 0,
      peakScore: 0,
    });
  }

  for (const set of data.setLogs) {
    const session = data.sessionById.get(set.sessionId);
    if (!session || session.clientId !== clientId) continue;
    if (session.status !== "completed" || !set.completed || set.isWarmup) continue;
    if (opts.from && session.date < opts.from) continue;
    if (opts.to && session.date > opts.to) continue;

    const scores = effectiveScores(data, set.exerciseId, set.modalityId);
    if (scores.size === 0) continue;

    const load = setLoad(data, set);
    const normalized = normalizedLoad(data, set);
    const reps = load.totalReps;

    for (const [muscleId, score] of scores) {
      const row = totals.get(muscleId);
      if (!row || score <= 0) continue;
      const weight = score / 10;
      row.sets += 1;
      row.peakScore = Math.max(row.peakScore, score);
      if (load.precision === "ordinal" || normalized === null) {
        row.ordinalReps += weight * reps;
      } else {
        row.weightedVolumeLbs += weight * reps * normalized;
      }
    }
  }

  return [...totals.values()];
}

// ---------------------------------------------------------------------------
// Availability
// ---------------------------------------------------------------------------

export type Variant = {
  exerciseModality: ExerciseModality;
  exerciseName: string;
  modalityName: string;
  /** Carried on the variant so client components (picker, set editor) don't
   *  need the whole catalog just to group by pattern or default a duration. */
  pattern: Exercise["pattern"];
  metricType: Exercise["metricType"];
  /** False when failing a rep could trap you and you have no spotter arms. */
  allowsFailure: boolean;
};

/**
 * Every exercise × modality you can actually perform with the equipment given.
 * This is the question a home-gym app exists to answer, and the old schema
 * could not: nothing joined equipment to exercises at all.
 */
export function availableVariants(
  catalog: ExerciseCatalog,
  owned: ReadonlySet<EquipmentId> = ownedEquipmentIds,
): Variant[] {
  const { exerciseById } = exerciseLookup(catalog);
  return catalog.exerciseModalities
    .filter((em) => modalityById.get(em.modalityId)?.owned !== false)
    .filter((em) => em.requiredEquipment.every((id) => owned.has(id)))
    .map((em) => ({
      exerciseModality: em,
      exerciseName: exerciseById.get(em.exerciseId)?.name ?? em.exerciseId,
      modalityName: modalityById.get(em.modalityId)?.name ?? em.modalityId,
      pattern: exerciseById.get(em.exerciseId)?.pattern ?? "isolation",
      metricType: exerciseById.get(em.exerciseId)?.metricType ?? "reps",
      allowsFailure: !em.pinRisk || owned.has("spotter_arms"),
    }));
}

/** Valid band roles for a variant. Assistance-only for pull-ups and dips;
 *  resistance-only for curls. */
export function bandRolesFor(
  catalog: ExerciseCatalog,
  exerciseId: ExerciseId,
  modalityId: ModalityId,
): readonly BandRole[] {
  return (
    exerciseLookup(catalog)
      .modalitiesByExercise.get(exerciseId)
      ?.find((em) => em.modalityId === modalityId)?.bandRoles ?? []
  );
}

/** Hip bands ordered easiest to hardest. Derived from circumference — smaller
 *  is harder — so it cannot drift out of sync with the inventory. */
export function hipBandLadder(): { band: HipBand; rank: number }[] {
  return hipBandsByDifficulty.map((band) => ({
    band,
    rank: hipBandRank.get(band.id) ?? 0,
  }));
}

// ---------------------------------------------------------------------------
// Programming
// ---------------------------------------------------------------------------


/** The routine prescribed for a client on a given weekday of the program's
 *  CURRENT week — multi-week programs schedule different routines per week,
 *  so filtering by dayOfWeek alone would offer week 1 forever. */
export function routineForDay(
  data: GymData,
  clientId: ClientId,
  dayOfWeek: number,
  todayIso: string,
) {
  const assignment = data.assignments.find(
    (a) => a.clientId === clientId && a.status === "active",
  );
  if (!assignment) return null;
  const program = data.programById.get(assignment.programId);
  const week = program ? currentProgramWeek(assignment, program, todayIso) : 1;
  const day = data.programDays.find(
    (d) =>
      d.programId === assignment.programId &&
      d.week === week &&
      d.dayOfWeek === dayOfWeek,
  );
  if (!day) return null;
  return {
    routineId: day.routineId,
    exercises: data.exercisesByRoutine.get(day.routineId) ?? [],
  };
}

