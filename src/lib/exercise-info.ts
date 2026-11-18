import { modalityById } from "./data/modalities";
import { muscleById } from "./data/muscles";
import { exerciseLookup, roleForScore, type ExerciseCatalog } from "./exercise-catalog";
import { effectiveScores, variantOf } from "./modality";
import type { ExerciseId, ModalityId, MuscleId } from "./types";

export type ExerciseInfo = {
  name: string;
  modalityId: ModalityId;
  cues: readonly string[];
  /** The variant's own note ("Neutral grip", "Band under the feet"). */
  variantNotes: string;
  /** Effective muscle scores for this variant (modality applied), best first. */
  scores: [MuscleId, number][];
  /** Muscle names in the primary, then secondary, role — best first. */
  primary: string[];
  secondary: string[];
  /** A YouTube search for a form demo — the exercise name only, nothing
   *  about the person. */
  demoUrl: string;
};

/** Everything "Explain exercise" shows for one variant. Null for an
 *  exercise the catalog doesn't have. */
export function exerciseInfo(
  catalog: ExerciseCatalog,
  exerciseId: ExerciseId,
  modalityId: ModalityId,
): ExerciseInfo | null {
  const { exerciseById } = exerciseLookup(catalog);
  const exercise = exerciseById.get(exerciseId);
  if (!exercise) return null;
  const scores = [...effectiveScores(catalog, exerciseId, modalityId)]
    .filter(([, score]) => score > 0)
    .sort((a, b) => b[1] - a[1]);
  const nameOf = (id: MuscleId) => muscleById.get(id)?.name ?? id;
  const implement =
    modalityId === "bodyweight" || modalityId === "cardio" ? "" : `${modalityById.get(modalityId)?.name ?? ""} `;
  return {
    name: exercise.name,
    modalityId,
    cues: exercise.cues ?? [],
    variantNotes: variantOf(catalog, { exerciseId, modalityId })?.notes ?? "",
    scores,
    primary: scores.filter(([, s]) => roleForScore(s) === "primary").map(([id]) => nameOf(id)),
    secondary: scores.filter(([, s]) => roleForScore(s) === "secondary").map(([id]) => nameOf(id)),
    demoUrl: `https://www.youtube.com/results?search_query=${encodeURIComponent(
      `${implement}${exercise.name} proper form`.trim(),
    )}`,
  };
}
