import type { FoodCategory, FoodCategoryId } from "../types";

/**
 * Generic plate-density classes for the nutrition tracker's plate-fraction
 * estimator. Every value is kcal/macros for a FULL single-layer 10 1/16"
 * Dixie plate of a typical food in the class (drinks: a full 12 oz glass).
 *
 * These are rough coaching estimates — the same spirit as `seedLoadFactor`:
 * directionally honest, deliberately round, and used only as DEFAULTS when a
 * food is created without known numbers. A food can override them with real
 * label values at creation.
 */
export const foodCategories: readonly FoodCategory[] = [
  {
    id: "lean_protein",
    label: "Lean protein",
    // ~500 g chicken breast / white fish covers a big plate one layer deep.
    plateKcal: 800,
    plateProteinG: 150,
    plateCarbsG: 0,
    plateFatG: 18,
  },
  {
    id: "fatty_protein",
    label: "Fatty protein",
    // Ground beef, salmon, thighs, eggs — denser per bite than lean cuts.
    plateKcal: 1200,
    plateProteinG: 105,
    plateCarbsG: 0,
    plateFatG: 85,
  },
  {
    id: "starchy_carb",
    label: "Starchy carb",
    // Rice, pasta, potatoes, oatmeal — a full plate is a LOT of starch.
    plateKcal: 900,
    plateProteinG: 20,
    plateCarbsG: 190,
    plateFatG: 5,
  },
  {
    id: "veggie",
    label: "Vegetables",
    // Non-starchy veg: volume-heavy, calorie-light.
    plateKcal: 175,
    plateProteinG: 10,
    plateCarbsG: 32,
    plateFatG: 2,
  },
  {
    id: "fruit",
    label: "Fruit",
    plateKcal: 350,
    plateProteinG: 4,
    plateCarbsG: 88,
    plateFatG: 1,
  },
  {
    id: "fried_fatty",
    label: "Fried / fatty",
    // Fries, pizza, fried chicken, casseroles heavy on oil or cheese.
    plateKcal: 1500,
    plateProteinG: 40,
    plateCarbsG: 140,
    plateFatG: 85,
  },
  {
    id: "dessert",
    label: "Dessert",
    plateKcal: 1700,
    plateProteinG: 20,
    plateCarbsG: 230,
    plateFatG: 75,
  },
  {
    id: "dairy",
    label: "Dairy",
    // Cheese, yogurt, cottage cheese.
    plateKcal: 1000,
    plateProteinG: 60,
    plateCarbsG: 35,
    plateFatG: 65,
  },
  {
    id: "drink",
    label: "Drink (12 oz glass)",
    // A "full plate" of a drink means one full 12 oz glass — soda-ish middle
    // ground between juice and milk.
    plateKcal: 150,
    plateProteinG: 3,
    plateCarbsG: 30,
    plateFatG: 2,
  },
];

export const foodCategoryById = new Map<FoodCategoryId, FoodCategory>(
  foodCategories.map((c) => [c.id, c]),
);
