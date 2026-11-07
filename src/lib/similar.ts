import { muscleById } from "./data/muscles";
import { exerciseLookup, roleForScore, type ExerciseCatalog } from "./exercise-catalog";
import { effectiveScores } from "./modality";
import type { Variant } from "./queries";
import type { ExerciseId, ModalityId, MuscleId } from "./types";

/**
 * Mid-session swap suggestions — "the barbell's taken, what else?".
 *
 * Two kinds, in this order:
 *  - `equipment`: the same movement on a different modality (Barbell Row →
 *    Dumbbell Row variant). Closest possible swap; the stimulus barely moves.
 *  - `similar`: a different exercise that loads the same muscles, ranked by
 *    cosine similarity of the modality-adjusted muscle vectors, nudged up
 *    for a shared movement pattern and a shared primary mover.
 *
 * Pure and catalog-only, so the runner can compute it client-side from the
 * serializable ExerciseCatalog slice it already has.
 */
export type SwapSuggestion = {
  variant: Variant;
  kind: "equipment" | "similar";
  /** Short why: the modality name, or the top shared muscles. */
  reason: string;
};

const SAME_PATTERN_BONUS = 0.15;
const SHARED_PRIMARY_BONUS = 0.1;
/** Below this a "similar" exercise isn't worth suggesting. */
const MIN_SIMILARITY = 0.35;

function cosine(a: ReadonlyMap<MuscleId, number>, b: ReadonlyMap<MuscleId, number>): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (const [muscle, score] of a) {
    na += score * score;
    dot += score * (b.get(muscle) ?? 0);
  }
  for (const score of b.values()) nb += score * score;
  return na === 0 || nb === 0 ? 0 : dot / Math.sqrt(na * nb);
}

function primaries(scores: ReadonlyMap<MuscleId, number>): Set<MuscleId> {
  return new Set([...scores].filter(([, s]) => roleForScore(s) === "primary").map(([m]) => m));
}

/** The muscles both exercises lean on most, strongest overlap first. */
function sharedMuscles(
  a: ReadonlyMap<MuscleId, number>,
  b: ReadonlyMap<MuscleId, number>,
  count: number,
): string {
  return [...a]
    .filter(([m]) => (b.get(m) ?? 0) > 0)
    .map(([m, s]) => [m, Math.min(s, b.get(m) ?? 0)] as const)
    .sort((x, y) => y[1] - x[1])
    .slice(0, count)
    .map(([m]) => (muscleById.get(m)?.name ?? m).replace(/\s*\(.*\)/, "").toLowerCase())
    .join(" · ");
}

export function swapSuggestions(
  catalog: ExerciseCatalog,
  variants: readonly Variant[],
  from: { exerciseId: ExerciseId; modalityId: ModalityId },
  limit = 6,
): SwapSuggestion[] {
  const { exerciseById } = exerciseLookup(catalog);
  const source = exerciseById.get(from.exerciseId);
  if (!source) return [];

  const equipment: SwapSuggestion[] = variants
    .filter(
      (v) =>
        v.exerciseModality.exerciseId === from.exerciseId &&
        v.exerciseModality.modalityId !== from.modalityId,
    )
    .map((variant) => ({ variant, kind: "equipment", reason: variant.modalityName }));

  const sourceScores = effectiveScores(catalog, from.exerciseId, from.modalityId);
  const sourcePrimaries = primaries(sourceScores);
  const isMobility = source.pattern === "mobility";

  // Best variant per other exercise — the default modality represents it,
  // falling back to whichever available variant scores highest.
  const best = new Map<ExerciseId, { variant: Variant; score: number; reason: string; metricMatch: boolean }>();
  for (const variant of variants) {
    const { exerciseId, modalityId, isDefault } = variant.exerciseModality;
    if (exerciseId === from.exerciseId) continue;
    // Mobility swaps for mobility only; strength never swaps into a stretch.
    if ((variant.pattern === "mobility") !== isMobility) continue;

    let score: number;
    let reason: string;
    if (isMobility) {
      // Stretches carry no muscle scores — same pattern is all we have.
      score = 0.5;
      reason = "mobility";
    } else {
      const scores = effectiveScores(catalog, exerciseId, modalityId);
      score = cosine(sourceScores, scores);
      if (variant.pattern === source.pattern) score += SAME_PATTERN_BONUS;
      if ([...primaries(scores)].some((m) => sourcePrimaries.has(m))) score += SHARED_PRIMARY_BONUS;
      reason = sharedMuscles(sourceScores, scores, 2);
      if (score < MIN_SIMILARITY) continue;
    }
    const prior = best.get(exerciseId);
    const better =
      !prior ||
      (isDefault && !prior.variant.exerciseModality.isDefault) ||
      (isDefault === prior.variant.exerciseModality.isDefault && score > prior.score);
    if (better) {
      best.set(exerciseId, {
        variant,
        score,
        reason,
        metricMatch: variant.metricType === source.metricType,
      });
    }
  }

  let ranked = [...best.values()];
  // A timed hold doesn't swap cleanly for a rep exercise — only offer a
  // mismatched metric when nothing matching exists.
  if (ranked.some((r) => r.metricMatch)) ranked = ranked.filter((r) => r.metricMatch);
  const similar: SwapSuggestion[] = ranked
    .sort((a, b) => b.score - a.score || a.variant.exerciseName.localeCompare(b.variant.exerciseName))
    .slice(0, Math.max(limit - equipment.length, 3))
    .map(({ variant, reason }) => ({ variant, kind: "similar", reason }));

  return [...equipment, ...similar];
}
