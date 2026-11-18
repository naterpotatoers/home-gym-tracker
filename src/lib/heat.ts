import { muscleById } from "./data/muscles";
import type { MuscleCoverage } from "./coverage";
import type { MuscleId } from "./types";

/**
 * Intensity math for the body heat map — prescribed coverage (weighted sets
 * per week) and single-exercise score previews. Intensity is normalized to
 * the screen's own max so the hottest muscle sits at the top of the ramp.
 */

export type HeatValue = {
  /** 0..1 on the screen's scale. Zero renders outline-only. */
  intensity: number;
  /** Human line for the detail row, in the value's own units. */
  detail: string;
};

type Coverage = ReadonlyMap<MuscleId, MuscleCoverage>;

/** The top of the scale: the most weighted sets any muscle gets. */
export function coverageMax(coverage: Coverage): number {
  let max = 0;
  for (const row of coverage.values()) max = Math.max(max, row.weightedSets);
  return max;
}

/** t in (0,1] → ramp bin 0..12. Zero intensity never calls this — it renders
 *  as outline-only, not as the lightest fill. */
export function heatBin(t: number): number {
  return Math.min(12, Math.floor(t * 13));
}

/** Weighted sets/week per muscle as heat, against `max`. */
export function coverageHeat(coverage: Coverage, max = coverageMax(coverage)): Map<MuscleId, HeatValue> {
  const out = new Map<MuscleId, HeatValue>();
  for (const [id, row] of coverage) {
    const name = muscleById.get(id)?.name ?? id;
    const value = row.weightedSets;
    out.set(id, {
      intensity: max > 0 ? value / max : 0,
      detail: value > 0 ? `${name} — ${value.toFixed(1)} weighted sets/week` : `${name} — not prescribed`,
    });
  }
  return out;
}

/** One exercise's muscle scores as heat — score / 10, labelled by muscle.
 *  The exercise editor's preview. */
export function heatFromScores(
  rows: Iterable<{ muscleId: MuscleId; score: number }>,
): Map<MuscleId, HeatValue> {
  const values = new Map<MuscleId, HeatValue>();
  for (const row of rows) {
    values.set(row.muscleId, {
      intensity: row.score / 10,
      detail: `${muscleById.get(row.muscleId)?.name ?? row.muscleId} — score ${row.score}`,
    });
  }
  return values;
}
