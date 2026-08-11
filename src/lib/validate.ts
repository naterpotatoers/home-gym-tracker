import { equipment } from "./data/equipment";
import { foodCategories } from "./data/food-categories";
import { modalities } from "./data/modalities";
import { muscles } from "./data/muscles";
import type {
  BandRole,
  EquipmentId,
  ExperienceLevel,
  FoodCategoryId,
  Goal,
  MetricType,
  ModalityId,
  MovementPattern,
  MuscleId,
  SessionCondition,
  UnilateralMode,
} from "./types";

/**
 * The database stores foreign keys into reference data as plain text — the id
 * unions only exist at compile time. Server actions run these guards before
 * writing so a malformed request cannot insert a dangling reference.
 *
 * Exercise ids are NOT here: exercises are database rows now, validated
 * against the live table via `assertExerciseIds` in actions/exercises.ts.
 */
const modalityIds = new Set<string>(modalities.map((m) => m.id));
const foodCategoryIds = new Set<string>(foodCategories.map((c) => c.id));
const muscleIds = new Set<string>(muscles.map((m) => m.id));
const equipmentIds = new Set<string>(equipment.map((e) => e.id));

export function isModalityId(id: string): id is ModalityId {
  return modalityIds.has(id);
}

export function isFoodCategoryId(id: string): id is FoodCategoryId {
  return foodCategoryIds.has(id);
}

export function isMuscleId(id: string): id is MuscleId {
  return muscleIds.has(id);
}

export function isEquipmentId(id: string): id is EquipmentId {
  return equipmentIds.has(id);
}

const conditions = new Set<string>(["rough", "tired", "normal", "good", "great"]);

export function isSessionCondition(value: string): value is SessionCondition {
  return conditions.has(value);
}

// Closed TS enums with no data file — literal arrays, kept in sync with
// types.ts by their type annotations. The arrays are exported for UIs that
// render one control per member (the guards derive from the same values, so
// pickers and validation can't drift apart).
const movementPatterns: readonly MovementPattern[] = [
  "squat", "hinge", "lunge", "push_h", "push_v", "pull_h", "pull_v",
  "carry", "core", "isolation", "mobility",
];
const metricTypes: readonly MetricType[] = ["reps", "time", "distance"];
export const BAND_ROLES: readonly BandRole[] = ["resistance", "assistance"];
export const UNILATERAL_MODES: readonly UnilateralMode[] = [
  "bilateral", "alternating", "single_side",
];
export const EXPERIENCE_LEVELS: readonly ExperienceLevel[] = [
  "beginner", "intermediate", "advanced",
];
export const GOALS: readonly Goal[] = [
  "general-fitness", "strength", "hypertrophy", "fat-loss",
];

/** Programs cap out at a year of weeks — shared by actions and the grid UI. */
export const MAX_PROGRAM_WEEKS = 52;

/** Local ISO day string (YYYY-MM-DD) — the app's only date wire format. */
export function isIsoDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

const movementPatternSet = new Set<string>(movementPatterns);
const metricTypeSet = new Set<string>(metricTypes);
const bandRoleSet = new Set<string>(BAND_ROLES);
const unilateralModeSet = new Set<string>(UNILATERAL_MODES);
const experienceLevelSet = new Set<string>(EXPERIENCE_LEVELS);
const goalSet = new Set<string>(GOALS);

export function isMovementPattern(value: string): value is MovementPattern {
  return movementPatternSet.has(value);
}

export function isMetricType(value: string): value is MetricType {
  return metricTypeSet.has(value);
}

export function isBandRole(value: string): value is BandRole {
  return bandRoleSet.has(value);
}

export function isUnilateralMode(value: string): value is UnilateralMode {
  return unilateralModeSet.has(value);
}

export function isExperienceLevel(value: string): value is ExperienceLevel {
  return experienceLevelSet.has(value);
}

export function isGoal(value: string): value is Goal {
  return goalSet.has(value);
}
