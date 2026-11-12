import { isCareRoutine } from "./data/care-routines";
import { exerciseLookup } from "./exercise-catalog";
import type { GymData } from "./gym-data";
import { effectiveScores } from "./modality";
import type { MuscleId, Routine, RoutineExercise, SetLog } from "./types";

/**
 * Care routines worth tacking onto the end of a session — "nice work, want
 * to hit some hamstring/ankle care while you're warm?". Ranked by cosine
 * overlap between the muscles the session actually trained (completed
 * working sets × modality-adjusted scores) and the muscles the care
 * routine's exercises touch (base scores; mobility rows count if scored).
 *
 * Empty when the session was itself a care routine or trained nothing.
 */
/** A care routine offered as "Continue your workout?" — plain data, so it
 *  crosses into the live runners. */
export type FinisherOption = {
  id: string;
  /** "Knee (Patellofemoral)" — the "Care:" prefix dropped. */
  name: string;
  /** Top matches for what this session trains. */
  suggested: boolean;
  prescriptions: RoutineExercise[];
};

/**
 * Every care routine not already in the session, as a mid-session add-on,
 * the best matches first. Ranked
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
  const inSession = new Set(sets.map((set) => `${set.exerciseId}|${set.modalityId}`));
  const alreadyAdded = (routine: Routine) => {
    const rxs = data.exercisesByRoutine.get(routine.id) ?? [];
    return rxs.length > 0 && rxs.every((rx) => inSession.has(`${rx.exerciseId}|${rx.modalityId}`));
  };

  const ranked = rankCare(data, sessionId, sets)
    .filter((r) => !alreadyAdded(r.routine))
    .slice(0, suggest)
    .map((r) => r.routine.id);
  const suggested = new Set(ranked);
  const toOption = (routine: Routine): FinisherOption => ({
    id: routine.id,
    name: routine.name.replace(/^care\s*:\s*/i, ""),
    suggested: suggested.has(routine.id),
    prescriptions: [...(data.exercisesByRoutine.get(routine.id) ?? [])],
  });
  const byId = new Map(data.routines.map((r) => [r.id, r]));
  return [
    ...ranked.map((id) => toOption(byId.get(id)!)),
    ...data.routines
      .filter((r) => isCareRoutine(r) && !suggested.has(r.id) && !alreadyAdded(r))
      .map(toOption)
      .sort((a, b) => a.name.localeCompare(b.name)),
  ];
}

/** Care routines scored by cosine overlap with `sets` (working sets only),
 *  best first; zero-overlap routines dropped. */
function rankCare(
  data: GymData,
  sessionId: string,
  sets: readonly SetLog[],
): { routine: Routine; score: number }[] {
  const session = data.sessionById.get(sessionId);
  if (!session) return [];
  const own = session.routineId ? data.routineById.get(session.routineId) : undefined;
  if (own && isCareRoutine(own)) return [];

  const trained = new Map<MuscleId, number>();
  for (const set of sets) {
    if (set.isWarmup) continue;
    for (const [muscle, score] of effectiveScores(data, set.exerciseId, set.modalityId)) {
      trained.set(muscle, (trained.get(muscle) ?? 0) + score);
    }
  }
  if (trained.size === 0) return [];
  const trainedNorm = Math.sqrt([...trained.values()].reduce((sum, v) => sum + v * v, 0));

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
      let dot = 0;
      let norm = 0;
      for (const [muscle, score] of touched) {
        dot += score * (trained.get(muscle) ?? 0);
        norm += score * score;
      }
      return { routine, score: norm === 0 ? 0 : dot / (Math.sqrt(norm) * trainedNorm) };
    })
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score || a.routine.name.localeCompare(b.routine.name));
}
