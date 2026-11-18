import { isFinisherRoutine } from "./built-in-routines";
import { isCareRoutine } from "./data/care-routines";
import { isCoreRoutine } from "./data/core-routines";
import { exerciseLookup, variantKey } from "./exercise-catalog";
import type { GymData } from "./gym-data";
import { effectiveScores } from "./modality";
import { estimatedMinutes } from "./routine-time";
import { cosine } from "./similar";
import type { MuscleId, Routine, RoutineExercise, SetLog } from "./types";

/** Care routines are ranked against the session; core finishers rotate
 *  (least recently done first); conditioning routines (only bike pieces,
 *  e.g. "Echo 20/10") are listed as-is. */
export type FinisherKind = "care" | "core" | "conditioning";

/** The finisher kinds in display order — the continue prompt's groups, the
 *  launcher's last groups and finisherOptions' sort all follow it. `prefix`
 *  re-tags a name where kinds mix (the "Suggested" group). */
export const FINISHER_GROUPS: readonly { kind: FinisherKind; label: string; prefix: string }[] = [
  { kind: "care", label: "Care & mobility", prefix: "Care: " },
  { kind: "core", label: "Core", prefix: "Core: " },
  { kind: "conditioning", label: "Conditioning", prefix: "" },
];

export function finisherGroupLabel(kind: FinisherKind): string {
  return FINISHER_GROUPS.find((g) => g.kind === kind)!.label;
}

/** A care, core or conditioning routine offered as "Continue your
 *  workout?" — plain data, so it crosses into the live runners. */
export type FinisherOption = {
  id: string;
  /** "Knee (Patellofemoral)" — the "Care:"/"Core:" prefix dropped. */
  name: string;
  kind: FinisherKind;
  /** The best care match and the next core finisher in the rotation. */
  suggested: boolean;
  /** Rough length (estimatedMinutes) — finishers are meant to be short. */
  minutes: number;
  prescriptions: RoutineExercise[];
};

function finisherKind(data: GymData, routine: Routine): FinisherKind | null {
  if (isCareRoutine(routine)) return "care";
  if (isCoreRoutine(routine)) return "core";
  return isConditioningRoutine(data, routine.id) ? "conditioning" : null;
}

/** A routine made only of conditioning rows — offered as a finisher. */
export function isConditioningRoutine(data: GymData, routineId: string): boolean {
  const rxs = data.exercisesByRoutine.get(routineId) ?? [];
  return (
    rxs.length > 0 &&
    rxs.every((rx) => data.exerciseById.get(rx.exerciseId)?.pattern === "conditioning")
  );
}

/**
 * Every finisher not already in the session, as a mid-session add-on:
 * suggestions first (the care routine that best matches what this session
 * trains, and the core finisher this person did least recently), then the
 * rest of the care, core and conditioning routines A–Z. Care is ranked on
 * the session's whole plan (planned + done working sets): at page load most
 * sets aren't logged yet, and the plan is what's being trained. Empty when
 * the session is itself care or core work.
 */
export function finisherOptions(data: GymData, sessionId: string): FinisherOption[] {
  const session = data.sessionById.get(sessionId);
  if (!session) return [];
  const own = session.routineId ? data.routineById.get(session.routineId) : undefined;
  if (own && isFinisherRoutine(own)) return [];

  const sets = data.setsBySession.get(sessionId) ?? [];
  // A finisher whose every exercise is already in the session was added
  // earlier (before a reload) — don't offer it again. Warm-ups don't count:
  // the bike warm-up must not hide an Echo Bike finisher.
  const inSession = new Set(
    sets.filter((set) => !set.isWarmup).map((set) => variantKey(set.exerciseId, set.modalityId)),
  );
  const alreadyAdded = (routine: Routine) => containsRoutine(data, inSession, routine.id);

  const careMatch = rankCare(data, sets).find((r) => !alreadyAdded(r.routine))?.routine;
  const coreNext = coreRotation(data, session.clientId, session.id).find((r) => !alreadyAdded(r));
  const suggested = new Set([careMatch?.id, coreNext?.id].filter((id): id is string => !!id));

  const toOption = (routine: Routine, kind: FinisherKind): FinisherOption => {
    const prescriptions = [...(data.exercisesByRoutine.get(routine.id) ?? [])];
    return {
      id: routine.id,
      name: routine.name.replace(/^(care|core)\s*:\s*/i, ""),
      kind,
      suggested: suggested.has(routine.id),
      minutes: estimatedMinutes(prescriptions),
      prescriptions,
    };
  };
  const options = data.routines.flatMap((routine) => {
    if (routine.id === own?.id || alreadyAdded(routine)) return [];
    const kind = finisherKind(data, routine);
    return kind ? [toOption(routine, kind)] : [];
  });
  const rank = (kind: FinisherKind) => FINISHER_GROUPS.findIndex((g) => g.kind === kind);
  return options.sort(
    (a, b) =>
      Number(b.suggested) - Number(a.suggested) ||
      rank(a.kind) - rank(b.kind) ||
      a.name.localeCompare(b.name),
  );
}

/**
 * The continue prompt's option groups: "Suggested finishers" (names tagged
 * with their kind, since care and core mix there), then one group per kind
 * in FINISHER_GROUPS order. Empty groups are dropped; each option reads
 * "Knee (Patellofemoral) · ~6 min".
 */
export function finisherGroups(
  options: readonly FinisherOption[],
): { label: string; options: { id: string; text: string }[] }[] {
  const text = (o: FinisherOption, tagged: boolean) => {
    const prefix = tagged ? FINISHER_GROUPS.find((g) => g.kind === o.kind)!.prefix : "";
    return `${prefix}${o.name} · ~${o.minutes} min`;
  };
  return [
    {
      label: "Suggested finishers",
      options: options.filter((o) => o.suggested).map((o) => ({ id: o.id, text: text(o, true) })),
    },
    ...FINISHER_GROUPS.map(({ kind, label }) => ({
      label,
      options: options
        .filter((o) => !o.suggested && o.kind === kind)
        .map((o) => ({ id: o.id, text: text(o, false) })),
    })),
  ].filter((group) => group.options.length > 0);
}

/** True when every exercise × implement of the routine is in `keys`. */
function containsRoutine(data: GymData, keys: ReadonlySet<string>, routineId: string): boolean {
  const rxs = data.exercisesByRoutine.get(routineId) ?? [];
  return rxs.length > 0 && rxs.every((rx) => keys.has(variantKey(rx.exerciseId, rx.modalityId)));
}

/**
 * Core finishers in rotation order for one person: never done first, then
 * the one done longest ago (ties by name). A finisher is appended to the
 * workout's own session, so "done" = a completed session holding every one
 * of the routine's exercises.
 */
export function coreRotation(data: GymData, clientId: string, excludeSessionId?: string): Routine[] {
  const lastDone = new Map<string, string>();
  const core = data.routines.filter(isCoreRoutine);
  for (const session of data.sessions) {
    if (session.clientId !== clientId || session.id === excludeSessionId) continue;
    if (session.status !== "completed") continue;
    const keys = new Set(
      (data.setsBySession.get(session.id) ?? [])
        .filter((set) => set.completed)
        .map((set) => variantKey(set.exerciseId, set.modalityId)),
    );
    for (const routine of core) {
      if (!containsRoutine(data, keys, routine.id)) continue;
      const prev = lastDone.get(routine.id);
      if (!prev || session.date > prev) lastDone.set(routine.id, session.date);
    }
  }
  return [...core].sort((a, b) => {
    const da = lastDone.get(a.id) ?? "";
    const db = lastDone.get(b.id) ?? "";
    return da.localeCompare(db) || a.name.localeCompare(b.name);
  });
}

/**
 * Care routines scored by cosine overlap between the muscles `sets` train
 * (every non-warmup set, done or planned × modality-adjusted scores) and the
 * muscles the routine's exercises touch (base scores; mobility rows count if
 * scored). Best first; zero-overlap routines dropped.
 */
function rankCare(data: GymData, sets: readonly SetLog[]): { routine: Routine; score: number }[] {
  const trained = new Map<MuscleId, number>();
  for (const set of sets) {
    if (set.isWarmup) continue;
    for (const [muscle, score] of effectiveScores(data, set.exerciseId, set.modalityId)) {
      trained.set(muscle, (trained.get(muscle) ?? 0) + score);
    }
  }
  if (trained.size === 0) return [];

  const { scoresByExercise } = exerciseLookup(data);
  return data.routines
    .filter(isCareRoutine)
    .map((routine) => {
      const touched = new Map<MuscleId, number>();
      for (const rx of data.exercisesByRoutine.get(routine.id) ?? []) {
        for (const row of scoresByExercise.get(rx.exerciseId) ?? []) {
          touched.set(row.muscleId, (touched.get(row.muscleId) ?? 0) + row.score);
        }
      }
      return { routine, score: cosine(touched, trained) };
    })
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score || a.routine.name.localeCompare(b.routine.name));
}
