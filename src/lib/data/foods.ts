import type { Food } from "../types";

/**
 * SEED FIXTURE — a handful of foods for the read-only fallback and the vitest
 * fixtures (`seedSnapshot()`). The CANONICAL starter catalog lives in
 * supabase/schema.sql (and apply_nutrition.sql); the live app reads foods from
 * the database, never from here. Values are per full 10 1/16" plate.
 */
export const foods: readonly Food[] = [
  { id: "f_chicken_breast", name: "Chicken breast", category: "lean_protein", plateKcal: 800, plateProteinG: 150, plateCarbsG: 0, plateFatG: 18 },
  { id: "f_white_rice", name: "White rice", category: "starchy_carb", plateKcal: 900, plateProteinG: 18, plateCarbsG: 195, plateFatG: 4 },
  { id: "f_broccoli", name: "Broccoli", category: "veggie", plateKcal: 150, plateProteinG: 12, plateCarbsG: 28, plateFatG: 2 },
  { id: "f_salmon", name: "Salmon", category: "fatty_protein", plateKcal: 1100, plateProteinG: 110, plateCarbsG: 0, plateFatG: 70 },
  { id: "f_banana", name: "Banana", category: "fruit", plateKcal: 320, plateProteinG: 4, plateCarbsG: 80, plateFatG: 1 },
  { id: "f_pizza", name: "Pizza", category: "fried_fatty", plateKcal: 1500, plateProteinG: 60, plateCarbsG: 150, plateFatG: 75 },
  { id: "f_greek_yogurt", name: "Greek yogurt", category: "dairy", plateKcal: 500, plateProteinG: 50, plateCarbsG: 30, plateFatG: 15 },
  { id: "f_milk", name: "Milk (12 oz glass)", category: "drink", plateKcal: 220, plateProteinG: 12, plateCarbsG: 18, plateFatG: 12 },
];
