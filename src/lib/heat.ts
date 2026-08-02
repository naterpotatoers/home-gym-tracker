import { muscleById } from "./data/muscles";
import type { MuscleCoverage } from "./coverage";
import type { MuscleVolume } from "./queries";
import type { MuscleId } from "./types";

/**
 * Intensity math for the muscle heat map. Everything is normalized against a
 * SHARED max across every period on screen — that is what makes week-vs-week
 * or program-vs-program comparison honest. Loaded (lbs) and ordinal (band
 * reps) work stay on separate scales; ordinal never fakes pounds.
 */

export type HeatValue = {
  /** 0..1 on the shared scale for the metric this mode uses. */
  intensity: number;
  /** Human line for the detail row, in the value's own honest units. */
  detail: string;
  /** True when a muscle was trained ONLY by ordinal (band) work. */
  ordinalOnly: boolean;
};

export type HeatInputs =
  | { volumes: MuscleVolume[] }
  | { coverage: ReadonlyMap<MuscleId, MuscleCoverage> };

function metricOf(inputs: HeatInputs): Map<MuscleId, number> {
  const out = new Map<MuscleId, number>();
  if ("volumes" in inputs) {
    for (const v of inputs.volumes) out.set(v.muscleId, v.weightedVolumeLbs);
  } else {
    for (const [id, row] of inputs.coverage) out.set(id, row.weightedSets);
  }
  return out;
}

function ordinalOf(inputs: HeatInputs): Map<MuscleId, number> {
  const out = new Map<MuscleId, number>();
  if ("volumes" in inputs) {
    for (const v of inputs.volumes) out.set(v.muscleId, v.ordinalReps);
  }
  return out;
}

/** Max of the mode's metric across every period being shown. */
export function heatMax(...inputs: HeatInputs[]): number {
  let max = 0;
  for (const input of inputs) {
    for (const value of metricOf(input).values()) max = Math.max(max, value);
  }
  return max;
}

/** Same, for the separate ordinal scale. */
export function ordinalMax(...inputs: HeatInputs[]): number {
  let max = 0;
  for (const input of inputs) {
    for (const value of ordinalOf(input).values()) max = Math.max(max, value);
  }
  return max;
}

/** t in (0,1] → ramp bin 0..12. Zero intensity never calls this — it renders
 *  as outline-only, not as the lightest fill. */
export function heatBin(t: number): number {
  return Math.min(12, Math.floor(t * 13));
}

export function heatValues(
  inputs: HeatInputs,
  sharedMax: number,
  sharedOrdinalMax: number,
): Map<MuscleId, HeatValue> {
  const metric = metricOf(inputs);
  const ordinal = ordinalOf(inputs);
  const out = new Map<MuscleId, HeatValue>();

  const ids = new Set<MuscleId>([...metric.keys(), ...ordinal.keys()]);
  for (const id of ids) {
    const name = muscleById.get(id)?.name ?? id;
    const value = metric.get(id) ?? 0;
    const ordinalValue = ordinal.get(id) ?? 0;
    const ordinalOnly = value === 0 && ordinalValue > 0;

    let intensity: number;
    let detail: string;
    if (ordinalOnly) {
      intensity = sharedOrdinalMax > 0 ? ordinalValue / sharedOrdinalMax : 0;
      detail = `${name} — ${Math.round(ordinalValue)} weighted reps (band, no lbs)`;
    } else if ("volumes" in inputs) {
      intensity = sharedMax > 0 ? value / sharedMax : 0;
      detail =
        value > 0
          ? `${name} — ${Math.round(value).toLocaleString()} lb·reps` +
            (ordinalValue > 0 ? ` + ${Math.round(ordinalValue)} band reps` : "")
          : `${name} — not trained`;
    } else {
      intensity = sharedMax > 0 ? value / sharedMax : 0;
      detail =
        value > 0
          ? `${name} — ${value.toFixed(1)} weighted sets/week`
          : `${name} — not prescribed`;
    }

    out.set(id, { intensity, detail, ordinalOnly });
  }
  return out;
}
