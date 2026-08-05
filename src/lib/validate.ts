import { exercises } from "./data/exercises";
import { foodCategories } from "./data/food-categories";
import { modalities } from "./data/modalities";
import type {
  ExerciseId,
  FoodCategoryId,
  ModalityId,
  SessionCondition,
} from "./types";

/**
 * The database stores foreign keys into reference data as plain text — the id
 * unions only exist at compile time. Server actions run these guards before
 * writing so a malformed request cannot insert a dangling reference.
 */
const exerciseIds = new Set<string>(exercises.map((e) => e.id));
const modalityIds = new Set<string>(modalities.map((m) => m.id));
const foodCategoryIds = new Set<string>(foodCategories.map((c) => c.id));

export function isExerciseId(id: string): id is ExerciseId {
  return exerciseIds.has(id);
}

export function isModalityId(id: string): id is ModalityId {
  return modalityIds.has(id);
}

export function isFoodCategoryId(id: string): id is FoodCategoryId {
  return foodCategoryIds.has(id);
}

const conditions = new Set<string>(["rough", "tired", "normal", "good", "great"]);

export function isSessionCondition(value: string): value is SessionCondition {
  return conditions.has(value);
}
