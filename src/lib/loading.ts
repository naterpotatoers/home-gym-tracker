import { barById, plates } from "./data/equipment";
import type { Bar, ModalityId } from "./types";

/**
 * Plate math. Everything here is pure and derived from `plates` in
 * data/equipment.ts, so adding or losing a plate size is a one-line data edit.
 *
 * All arithmetic runs in integer quarter-pounds (×4) rather than floats, since
 * 1.25 and 2.5 lb plates otherwise accumulate binary rounding error.
 */

const UNIT = 4; // quarter-pounds per pound
const toUnits = (lbs: number) => Math.round(lbs * UNIT);
const toLbs = (units: number) => units / UNIT;

export type BarId = Bar["id"];

/** One of each plate available on a single side of the bar. */
const perSidePlateUnits: readonly number[] = plates
  .flatMap((p) => Array.from({ length: p.pairs }, () => toUnits(p.weightLbs)))
  .sort((a, b) => b - a);

/** Every distinct per-side plate total, ascending. */
const perSideSumUnits: readonly number[] = (() => {
  const sums = new Set<number>([0]);
  for (const plate of perSidePlateUnits) {
    for (const existing of [...sums]) sums.add(existing + plate);
  }
  return [...sums].sort((a, b) => a - b);
})();

/**
 * Every weight you can actually build on a given bar, ascending.
 *
 * With the current inventory (smallest plate 2.5 lb) this is contiguous on a
 * 5 lb grid: in 2.5 lb units the per-side set is {1, 2, 4, 6, 10, 14, 18, 22},
 * where 1/2/4 covers 0-7 with no gaps and every larger plate shifts that
 * window by less than its own width. A 1.25 lb pair would halve the grid.
 */
export function loadableWeights(barId: BarId): number[] {
  const bar = barById.get(barId);
  if (!bar) throw new Error(`Unknown bar: ${barId}`);
  const barUnits = toUnits(bar.weightLbs);
  return perSideSumUnits.map((side) => toLbs(barUnits + side * 2));
}


/** Closest buildable weight in either direction. Ties round down — a load you
 *  can definitely complete beats one you might miss. */
export function nearestLoadableWeight(
  target: number,
  barId: BarId = "ohio_bar",
): number | null {
  const options = loadableWeights(barId);
  if (options.length === 0) return null;
  let best = options[0];
  let bestGap = Math.abs(target - best);
  for (const option of options) {
    const gap = Math.abs(target - option);
    if (gap < bestGap || (gap === bestGap && option < best)) {
      best = option;
      bestGap = gap;
    }
  }
  return best;
}

export type PlateBreakdown = {
  totalLbs: number;
  barId: BarId;
  barLbs: number;
  /** Plates to hang on ONE side, heaviest first. */
  perSideLbs: number[];
};

/**
 * Exact plate combination for a target weight, or null if unbuildable.
 *
 * Uses a real subset search rather than greedy. Greedy happens to work for the
 * current nine-size inventory, but it silently produces wrong answers on other
 * plate sets, and this is the function that tells you what to put on the bar.
 */
export function formatPlates(
  totalLbs: number,
  barId: BarId = DEFAULT_BAR,
): PlateBreakdown | null {
  const bar = barById.get(barId);
  if (!bar) throw new Error(`Unknown bar: ${barId}`);
  const perSideUnits = toUnits(totalLbs) - toUnits(bar.weightLbs);
  if (perSideUnits < 0 || perSideUnits % 2 !== 0) return null;

  const found = findSubset(perSideUnits / 2, 0, []);
  if (!found) return null;
  return {
    totalLbs,
    barId,
    barLbs: bar.weightLbs,
    perSideLbs: found.map(toLbs),
  };
}

function findSubset(
  remaining: number,
  index: number,
  picked: number[],
): number[] | null {
  if (remaining === 0) return picked;
  if (index >= perSidePlateUnits.length) return null;
  const plate = perSidePlateUnits[index];
  if (plate <= remaining) {
    const withPlate = findSubset(remaining - plate, index + 1, [...picked, plate]);
    if (withPlate) return withPlate;
  }
  return findSubset(remaining, index + 1, picked);
}

/** The bar a plate hint assumes unless the weight says otherwise. */
const DEFAULT_BAR: BarId = "ohio_bar";

/**
 * The plates for a weight on whichever bar can build it — the 45 lb Ohio
 * first, then the others. The app doesn't record which bar is loaded, and
 * doesn't need to: the bars' grids never overlap (the Ohio builds 45, 50,
 * 55…; the 33 lb Bella 33, 38, 43…), so the weight itself names the bar.
 * Null when no bar can build it.
 */
export function platesFor(totalLbs: number): PlateBreakdown | null {
  const order = [DEFAULT_BAR, ...[...barById.keys()].filter((id) => id !== DEFAULT_BAR)];
  for (const barId of order) {
    const breakdown = formatPlates(totalLbs, barId);
    if (breakdown) return breakdown;
  }
  return null;
}

/** Human-readable side loading, e.g. "45 + 25 + 2.5 per side" — led by the
 *  bar when it isn't the usual one: "Bella Bar + 5 per side". */
export function describePlates(breakdown: PlateBreakdown): string {
  const other =
    breakdown.barId === DEFAULT_BAR ? null : (barById.get(breakdown.barId)?.name.replace(/^Rogue /, "") ?? null);
  if (breakdown.perSideLbs.length === 0) return other ? `empty ${other}` : "empty bar";
  const side = `${breakdown.perSideLbs.join(" + ")} per side`;
  return other ? `${other} + ${side}` : side;
}

/** The ± stepper increment for a set's weight field (per implement for
 *  dumbbells, added load for bodyweight). Null where weight isn't a number
 *  the lifter nudges — bands pick a band instead. */
export function weightStep(modalityId: ModalityId): number | null {
  switch (modalityId) {
    case "barbell":
    case "machine":
      return 5;
    case "dumbbell":
    case "bodyweight":
      return 2.5;
    case "band":
    case "cardio":
    case "ankle_weight":
      return null;
  }
}


