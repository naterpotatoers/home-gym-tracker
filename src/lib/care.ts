import { isCareRoutine } from "./data/care-routines";
import { exerciseLookup, variantKey } from "./exercise-catalog";
import type { GymData } from "./gym-data";
import { effectiveScores } from "./modality";
import { cosine } from "./similar";
import type { MuscleId, Routine, RoutineExercise, SetLog } from "./types";

/** A care or conditioning routine offered as "Continue your workout?" —
 *  plain data, so it crosses into the live runners. */
export type FinisherOption = {
  id: string;
  /** "Knee (Patellofemoral)" — the "Care:" prefix dropped. */
  name: string;
  /** Care routines are ranked against the session; conditioning routines
   *  (only bike pieces, e.g. "Echo 20/10") are listed as-is. */
  kind: "care" | "conditioning";
  /** Top matches for what this session trains. */
  suggested: boolean;
  prescriptions: RoutineExercise[];
};

/** A routine made only of conditioning rows — offered as a finisher. */
export function isConditioningRoutine(data: GymData, routineId: string): boolean {
  const rxs = data.exercisesByRoutine.get(routineId) ?? [];
  return (
    rxs.length > 0 &&
    rxs.every((rx) => data.exerciseById.get(rx.exerciseId)?.pattern === "conditioning")
  );
}

/**
 * Every care routine not already in the session, as a mid-session add-on,
 * the best matches first, then the conditioning routines. Ranked
 * on the session's whole plan (planned + done working sets): at page load
 * most sets aren't logged yet, and the plan is what's being trained. Empty
 * when the session is itself care work.
 */
export function finisherOptions(data: GymData, sessionId: string, suggest = 2): FinisherOption[] {
  const session = data.sessionById.get(sessionId);
  if (!session) return [];
  const own = session.routineId ? data.routineById.get(session.routineId) : undefined;
  if (own && isCareRoutine(own)) return [];

  const sets = data.setsBySession.get(sessionId) ?? [];
  // A finisher whose every exercise is already in the session was added
  // earlier (before a reload) — don't offer it again.
  const inSession = new Set(sets.map((set) => variantKey(set.exerciseId, set.modalityId)));
  const alreadyAdded = (routine: Routine) => {
    const rxs = data.exercisesByRoutine.get(routine.id) ?? [];
    return rxs.length > 0 && rxs.every((rx) => inSession.has(variantKey(rx.exerciseId, rx.modalityId)));
  };

  const ranked = rankCare(data, sets)
    .filter((r) => !alreadyAdded(r.routine))
    .slice(0, suggest)
    .map((r) => r.routine.id);
  const suggested = new Set(ranked);
  const toOption = (routine: Routine): FinisherOption => ({
    id: routine.id,
    name: routine.name.replace(/^care\s*:\s*/i, ""),
    kind: isCareRoutine(routine) ? "care" : "conditioning",
    suggested: suggested.has(routine.id),
    prescriptions: [...(data.exercisesByRoutine.get(routine.id) ?? [])],
  });
  return [
    ...ranked.map((id) => toOption(data.routineById.get(id)!)),
    ...data.routines
      .filter((r) => isCareRoutine(r) && !suggested.has(r.id) && !alreadyAdded(r))
      .map(toOption)
      .sort((a, b) => a.name.localeCompare(b.name)),
    ...data.routines
      .filter((r) => r.id !== own?.id && isConditioningRoutine(data, r.id) && !alreadyAdded(r))
      .map(toOption)
      .sort((a, b) => a.name.localeCompare(b.name)),
  ];
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
