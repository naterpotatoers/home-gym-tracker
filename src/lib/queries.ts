import {
  hipBandRank,
  hipBandsByDifficulty,
  ownedEquipmentIds,
} from "./data/equipment";
import { modalityById } from "./data/modalities";
import { exerciseLookup, groupBy, isStrengthPattern, variantKey, type ExerciseCatalog } from "./exercise-catalog";
import { activeAssignment, type GymData } from "./gym-data";
import { ageOnIso, currentProgramWeek, localIso, programEnded } from "./periods";
import { conditioningSetLabel, loadLabel } from "./session-labels";
import { toBlocks, type Block } from "./set-blocks";
import { weighInHistory } from "./weigh-ins";
import {
  bestE1rm,
  implementsPerRep,
  latestBodyweight,
  setLoad,
  sidesWorked,
  variantOf,
  workingSets,
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
  Session,
  SetLog,
} from "./types";

// ---------------------------------------------------------------------------
// People
// ---------------------------------------------------------------------------

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
    // Starting weight: the last weigh-in on/before joining, else the first
    // one after (people usually step on the scale after signing up).
    const atJoin =
      latestBodyweight(data, client.id, client.joinDate) ??
      weighInHistory(data, client.id)[0]?.bodyweightLbs ??
      null;
    return {
      client,
      age: ageOnIso(client.dateOfBirth, isoToday),
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
  const byDate = groupBy(
    data.sessions.filter((s) => s.status === "planned"),
    (s) => s.date,
  );
  return [...byDate]
    .filter(([, sessions]) => sessions.length >= 2)
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([date, sessions]) => ({ date, sessionIds: sessions.map((s) => s.id) }));
}

/** Where a one-tap start should send a client who already has an unfinished
 *  session: the shared board when it belongs to an open board group,
 *  otherwise the solo runner. Null when nothing is planned. Entry points use
 *  this to offer Resume instead of silently starting a duplicate session. */
export function resumeTargetForClient(
  data: GymData,
  clientId: ClientId,
): { href: string; sessionId: string; routineId: string | null; date: string } | null {
  const session = data.sessions
    .filter((s) => s.clientId === clientId && s.status === "planned")
    .sort((a, b) => b.date.localeCompare(a.date))[0];
  if (!session) return null;
  const group = openBoardGroups(data).find((g) => g.sessionIds.includes(session.id));
  return {
    href: group
      ? `/workout/group/board?s=${group.sessionIds.join(",")}`
      : `/workout/session/${session.id}`,
    sessionId: session.id,
    routineId: session.routineId,
    date: session.date,
  };
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

/** Total honest pounds moved in a session's completed working sets. Warmups,
 *  ordinal (band-rank) work and non-strength work (stretches, bike pieces)
 *  stay out — no fake numbers in a lbs total. */
export function sessionVolumeLbs(data: GymData, sessionId: string): number {
  return setsFor(data, sessionId)
    .filter((s) => s.completed && !s.isWarmup && isStrengthPattern(data.exerciseById.get(s.exerciseId)?.pattern))
    .reduce((sum, set) => {
      const load = setLoad(data, set);
      return load.lbs === null ? sum : sum + load.lbs * load.totalReps;
    }, 0);
}

/** One-line description of a set, in the units that set was actually measured
 *  in. Ordinal loads render as a band name, never as a number. */
export function describeSet(data: GymData, set: SetLog): string {
  if (set.conditioning) return conditioningSetLabel(set);
  const parts: string[] = [];

  if (set.durationSeconds !== null) parts.push(`${set.durationSeconds}s`);
  if (set.distanceFeet !== null) parts.push(`${set.distanceFeet} ft`);
  if (set.reps !== null) {
    parts.push(sidesWorked(set) > 1 ? `${set.reps} × ${sidesWorked(set)} sides` : `${set.reps} reps`);
  }

  if (set.modalityId === "dumbbell" && set.weightLbs !== null) {
    // Per implement as entered; the total only when it says something new
    // (two dumbbells, or the lifter's bodyweight riding along) and is known.
    const each = implementsPerRep(data, set) > 1 ? " ea" : "";
    const total = setLoad(data, set).lbs;
    parts.push(
      total !== null && total !== set.weightLbs
        ? `${set.weightLbs} lb${each} (${total} total)`
        : `${set.weightLbs} lb${each}`,
    );
  } else if (set.modalityId === "ankle_weight") {
    if (set.weightLbs !== null) parts.push(`${set.weightLbs} lb ankle weight`);
  } else {
    const load = loadLabel(set, { verbose: true });
    if (load && load !== "BW") parts.push(load);
  }

  if (set.rir !== null) parts.push(set.rir === 0 ? "to failure" : `RIR ${set.rir}`);
  return parts.join(" · ");
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

/** Every exercise × modality anyone has actually trained, with who trained
 *  it and when — feeds the picker's "Recent" group. */
type TrainedVariant = {
  exerciseId: ExerciseId;
  modalityId: ModalityId;
  clients: ClientId[];
  lastDate: string;
};

function trainedVariants(data: GymData): TrainedVariant[] {
  const byKey = new Map<string, TrainedVariant & { clientSet: Set<ClientId> }>();
  for (const set of data.setLogs) {
    if (set.isWarmup || !set.completed) continue;
    const session = data.sessionById.get(set.sessionId);
    if (!session) continue;
    const key = variantKey(set.exerciseId, set.modalityId);
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

export type RecapBlock = SetBlock & {
  done: number;
  /** Set when this completed session beat every earlier completed session's
   *  best e1RM for the variant — the recap's PR badge. */
  pr: { bestLbs: number; priorLbs: number } | null;
};

/** A finished session's recap, page-ready: blocks with done counts and PR
 *  calls, plus the headline stats. Skipped sessions never claim PRs. */
export function sessionRecap(data: GymData, sessionId: string) {
  const session = data.sessionById.get(sessionId);
  const blocks: RecapBlock[] = blocksFor(data, sessionId).map((block) => {
    const working = block.sets.filter((s) => s.completed && !s.isWarmup);
    const best = bestE1rm(data, working);
    const prior =
      session?.status === "completed" && best !== null
        ? priorBestE1rm(data, session.clientId, block.exerciseId, block.modalityId, session.id, session.date)
        : null;
    return {
      ...block,
      done: block.sets.filter((s) => s.completed).length,
      pr: best !== null && prior !== null && best > prior ? { bestLbs: best, priorLbs: prior } : null,
    };
  });
  return {
    blocks,
    workingSets: blocks.flatMap((b) => b.sets).filter((s) => s.completed && !s.isWarmup).length,
    volumeLbs: sessionVolumeLbs(data, sessionId),
  };
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
    .map((v) => variantKey(v.exerciseId, v.modalityId));
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
// Availability
// ---------------------------------------------------------------------------

export type Variant = {
  exerciseModality: ExerciseModality;
  exerciseName: string;
  /** Alternative names ("Overhead Press") so picker search finds them. */
  exerciseAliases: readonly string[];
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
      exerciseAliases: exerciseById.get(em.exerciseId)?.aliases ?? [],
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
  return variantOf(catalog, { exerciseId, modalityId })?.bandRoles ?? [];
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
 *  so filtering by dayOfWeek alone would offer week 1 forever. Null once the
 *  program has run its length. */
export function routineForDay(
  data: GymData,
  clientId: ClientId,
  dayOfWeek: number,
  todayIso: string,
) {
  const assignment = activeAssignment(data, clientId);
  if (!assignment) return null;
  const program = data.programById.get(assignment.programId);
  // A program runs its length, then stops — Home prompts to complete or
  // restart it instead of serving the final week forever.
  if (program && programEnded(assignment, program, todayIso)) return null;
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

