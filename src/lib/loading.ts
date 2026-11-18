import { barById, dumbbells, plates } from "./data/equipment";
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
 * With the current inventory this is contiguous on a 2.5 lb grid: in 1.25 lb
 * units the per-side set is {1, 2, 4, 8, 12, 20, 28, 36, 44}, where 1/2/4/8
 * covers 0-15 with no gaps and every larger plate shifts that window by less
 * than its own width. Before the change plates it was irregular (45, 65, 75,
 * 95, … with holes at 85 and 105) and the minimum jump was 20 lb.
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
  barId: BarId = "ohio_bar",
): PlateBreakdown | null {
  const bar = barById.get(barId);
  if (!bar) throw new Error(`Unknown bar: ${barId}`);
  const perSideUnits = toUnits(totalLbs) - toUnits(bar.weightLbs);
  if (perSideUnits < 0 || perSideUnits % 2 !== 0) return null;

  const found = findSubset(perSideUnits / 2, 0, []);
  if (!found) return null;
  return {
    totalLbs,
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

/** Human-readable side loading, e.g. "45 + 25 + 2.5 per side". */
export function describePlates(breakdown: PlateBreakdown): string {
  if (breakdown.perSideLbs.length === 0) return "empty bar";
  return `${breakdown.perSideLbs.join(" + ")} per side`;
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
    default:
      return null;
  }
}

/** The bars, in "which grid is this weight on?" order — the Ohio (45 +
 *  2.5k) and Bella (33 + 2.5k) grids never overlap. */
const BAR_IDS: readonly BarId[] = ["ohio_bar", "bella_bar"];

/**
 * The next heavier load you can actually build, in the SetLog's own field
 * semantics: barbell = total on the bar (the next weight at least one
 * stepper step — 5 lb, 2.5 a side — up on that bar's plate grid), dumbbell =
 * the next pair you own, machine = one stepper step,
 * bodyweight = the next dumbbell to hold or belt on (null at plain
 * bodyweight — that progresses by reps). Null when there's no heavier step,
 * or for bands (rank) and cardio (watts).
 */
export function nextLoadStep(modalityId: ModalityId, weightLbs: number): number | null {
  const ownedAbove = (lbs: number) =>
    dumbbells
      .map((d) => d.weightLbs)
      .sort((a, b) => a - b)
      .find((w) => w > lbs) ?? null;
  switch (modalityId) {
    case "barbell": {
      const onGrid = (id: BarId) => loadableWeights(id).some((w) => Math.abs(w - weightLbs) < 0.01);
      const bar = BAR_IDS.find(onGrid) ?? "ohio_bar";
      return loadableWeights(bar).find((w) => w >= weightLbs + weightStep("barbell")! - 0.01) ?? null;
    }
    case "dumbbell":
      return ownedAbove(weightLbs);
    case "machine":
      return weightLbs + weightStep("machine")!;
    case "bodyweight":
      return weightLbs > 0 ? ownedAbove(weightLbs) : null;
    default:
      return null;
  }
}

