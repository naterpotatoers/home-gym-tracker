import type { GymData } from "./gym-data";
import { nameKey } from "./names";
import type { ClientId, Food, FoodLog } from "./types";

/**
 * Pure nutrition queries — synchronous over `GymData`, like weigh-ins.ts.
 * The estimation model: a food's kcal/macros are authored for a FULL
 * single-layer 10 1/16" Dixie plate, and a log records the covered plate
 * fraction. A pie sector's area is linear in its angle, so the slider's
 * sweep fraction IS the plate fraction — no area math needed.
 */

export type Macros = {
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
};

/** A food's kcal/macros scaled to the covered plate fraction. */
export function scaledMacros(food: Food, fraction: number): Macros {
  return {
    kcal: food.plateKcal * fraction,
    proteinG: food.plateProteinG * fraction,
    carbsG: food.plateCarbsG * fraction,
    fatG: food.plateFatG * fraction,
  };
}

/** Foods whose name contains the query (case-insensitive), name-sorted.
 *  Empty query returns the whole catalog. Takes the plain array (not
 *  GymData) so the client-side search box can reuse it. */
export function searchFoods(foods: readonly Food[], query: string): Food[] {
  const q = nameKey(query);
  return foods
    .filter((f) => f.name.toLowerCase().includes(q))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** Sum of the snapshot values — never recomputed from current food data. */
export function dayTotals(logs: readonly FoodLog[]): Macros {
  const out = { kcal: 0, proteinG: 0, carbsG: 0, fatG: 0 };
  for (const log of logs) {
    out.kcal += log.kcal;
    out.proteinG += log.proteinG;
    out.carbsG += log.carbsG;
    out.fatG += log.fatG;
  }
  return out;
}

export type RecentFood = {
  food: Food;
  /** The fraction from this food's most recent log — the relog prefill. */
  lastFraction: number;
};

/** Distinct foods from a client's history, most recently eaten first — the
 *  one-tap relog row. */
export function recentFoods(data: GymData, clientId: ClientId, limit = 8): RecentFood[] {
  const logs = data.foodLogs
    .filter((l) => l.clientId === clientId)
    .sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
  const out: RecentFood[] = [];
  const seen = new Set<string>();
  for (const log of logs) {
    if (seen.has(log.foodId)) continue;
    seen.add(log.foodId);
    const food = data.foodById.get(log.foodId);
    if (!food) continue;
    out.push({ food, lastFraction: log.plateFraction });
    if (out.length >= limit) break;
  }
  return out;
}

/** Friendly fraction label: exact quarters/thirds read as "¼ plate", anything
 *  else as a percentage. */
export function fractionLabel(fraction: number): string {
  const named: [number, string][] = [
    [1, "full plate"],
    [3 / 4, "¾ plate"],
    [2 / 3, "⅔ plate"],
    [1 / 2, "½ plate"],
    [1 / 3, "⅓ plate"],
    [1 / 4, "¼ plate"],
  ];
  for (const [value, label] of named) {
    if (Math.abs(fraction - value) < 0.02) return label;
  }
  return `${Math.round(fraction * 100)}% plate`;
}
