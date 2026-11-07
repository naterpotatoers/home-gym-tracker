import { isCareRoutine } from "./data/care-routines";
import { exerciseLookup } from "./exercise-catalog";
import type { GymData } from "./gym-data";
import { effectiveScores } from "./modality";
import type { MuscleId, Routine } from "./types";

/**
 * Care routines worth tacking onto the end of a session — "nice work, want
 * to hit some hamstring/ankle care while you're warm?". Ranked by cosine
 * overlap between the muscles the session actually trained (completed
 * working sets × modality-adjusted scores) and the muscles the care
 * routine's exercises touch (base scores; mobility rows count if scored).
 *
 * Empty when the session was itself a care routine or trained nothing.
 */
export function suggestFinishers(data: GymData, sessionId: string, limit = 2): Routine[] {
  const session = data.sessionById.get(sessionId);
  if (!session) return [];
  const own = session.routineId ? data.routineById.get(session.routineId) : undefined;
  if (own && isCareRoutine(own)) return [];

  const trained = new Map<MuscleId, number>();
  for (const set of data.setsBySession.get(sessionId) ?? []) {
    if (!set.completed || set.isWarmup) continue;
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
    .sort((a, b) => b.score - a.score || a.routine.name.localeCompare(b.routine.name))
    .slice(0, limit)
    .map((r) => r.routine);
}
