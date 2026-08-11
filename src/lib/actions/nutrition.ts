"use server";

import { foodCategoryById } from "../data/food-categories";
import { supabase } from "../db/client";
import { foodLogToRow, foodToRow, rowToFood, type FoodRow } from "../db/mappers";
import { newId, slugId } from "../ids";
import { normalizeName } from "../names";
import { scaledMacros } from "../nutrition";
import type { Food } from "../types";
import { isFoodCategoryId, isIsoDate } from "../validate";
import { revalidateAll, run, runOrDuplicate } from "./_helpers";
import { assertClientId } from "./clients";

export type CreateFoodInput = {
  name: string;
  category: string;
  /** Per-plate overrides; null/absent fields fall back to the category
   *  defaults (the generic plate-density estimate). */
  plateKcal?: number | null;
  plateProteinG?: number | null;
  plateCarbsG?: number | null;
  plateFatG?: number | null;
};

/** Create a catalog food. The unique lower(name) index makes exact duplicates
 *  a clean failure rather than clutter. Returns the created food so the UI
 *  can log it immediately. */
export async function createFood(input: CreateFoodInput): Promise<Food> {
  const name = normalizeName(input.name);
  if (!name) throw new Error("A food needs a name.");
  if (!isFoodCategoryId(input.category)) throw new Error(`bad category ${input.category}`);
  const defaults = foodCategoryById.get(input.category)!;

  const value = (override: number | null | undefined, fallback: number, label: string) => {
    if (override === null || override === undefined) return fallback;
    if (!Number.isFinite(override) || override < 0 || override > 10000) {
      throw new Error(`${label} must be between 0 and 10000.`);
    }
    return override;
  };

  const food: Food = {
    id: slugId("f", name),
    name,
    category: input.category,
    plateKcal: value(input.plateKcal, defaults.plateKcal, "Calories"),
    plateProteinG: value(input.plateProteinG, defaults.plateProteinG, "Protein"),
    plateCarbsG: value(input.plateCarbsG, defaults.plateCarbsG, "Carbs"),
    plateFatG: value(input.plateFatG, defaults.plateFatG, "Fat"),
  };

  await runOrDuplicate(
    "adding food",
    supabase.from("foods").insert(foodToRow(food)),
    `"${name}" is already in the catalog — search for it instead.`,
  );
  revalidateAll();
  return food;
}

/** Log a food for a client/day at a plate fraction. The kcal/macro snapshot
 *  is recomputed server-side from the stored food — never trusted from the
 *  client — so history stays consistent with the catalog at log time. */
export async function logFood(
  clientId: string,
  foodId: string,
  date: string,
  plateFraction: number,
): Promise<void> {
  await assertClientId(clientId);
  if (!isIsoDate(date)) throw new Error("Pick a date.");
  if (!Number.isFinite(plateFraction) || plateFraction <= 0 || plateFraction > 1) {
    throw new Error("Plate fraction must be between 0 and 1.");
  }

  const foodRow = await run(
    "loading food",
    supabase.from("foods").select("*").eq("id", foodId).maybeSingle<FoodRow>(),
  );
  if (!foodRow) throw new Error(`bad food id ${foodId}`);
  const food = rowToFood(foodRow);
  const macros = scaledMacros(food, plateFraction);

  await run(
    "logging food",
    supabase.from("food_logs").insert(
      foodLogToRow({
        id: newId("fl"),
        clientId,
        date,
        foodId,
        plateFraction,
        kcal: macros.kcal,
        proteinG: macros.proteinG,
        carbsG: macros.carbsG,
        fatG: macros.fatG,
      }),
    ),
  );
  revalidateAll();
}

export async function deleteFoodLog(id: string): Promise<void> {
  await run("deleting food log", supabase.from("food_logs").delete().eq("id", id));
  revalidateAll();
}
