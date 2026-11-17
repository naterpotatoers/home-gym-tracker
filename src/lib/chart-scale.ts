/** "Nice" axis steps — gridlines land on round numbers a lifter reads at a
 *  glance. */
const NICE_STEPS = [5, 10, 25, 50, 100];

export type YScale = { min: number; max: number; step: number; grid: number[] };

/**
 * A non-zero-based y-axis for a progress line (zero-basing flattens
 * progress): roughly four gridlines, snapped outward to a nice step that
 * covers every value. A flat series still gets a visible band.
 */
export function niceYScale(values: readonly number[]): YScale {
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const rawStep = (hi - lo) / 4 || 5;
  const step = NICE_STEPS.find((s) => s >= rawStep) ?? Math.ceil(rawStep / 100) * 100;
  let min = Math.floor(lo / step) * step;
  let max = Math.ceil(hi / step) * step;
  if (min === max) {
    min -= step;
    max += step;
  }
  const grid: number[] = [];
  for (let v = min; v <= max; v += step) grid.push(v);
  return { min, max, step, grid };
}
