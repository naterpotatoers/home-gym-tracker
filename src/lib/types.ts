/**
 * Every entity in this app uses `id: string`, always a readable slug, never a
 * number. Foreign keys are named `<entity>Id`. Reference tables (things you
 * curate by hand) get an explicit id union below so a typo is a compile error;
 * records that grow over time (sessions, sets, weigh-ins) use plain `string`.
 */

// ---------------------------------------------------------------------------
// Reference-table id unions
// ---------------------------------------------------------------------------

export type MuscleGroupId =
  | "chest"
  | "back"
  | "shoulders"
  | "arms"
  | "legs"
  | "core";

export type MuscleId =
  // chest
  | "upper_chest"
  | "mid_chest"
  | "lower_chest"
  // back
  | "lats"
  | "traps"
  | "rhomboids"
  | "lower_back"
  // shoulders
  | "front_delts"
  | "side_delts"
  | "rear_delts"
  | "rotator_cuff"
  | "serratus"
  // arms
  | "biceps"
  | "triceps"
  | "forearms"
  // legs
  | "quads"
  | "hamstrings"
  | "glutes"
  | "glute_med"
  | "adductors"
  | "calves"
  | "tibialis"
  | "hip_flexors"
  // core
  | "abs"
  | "obliques";

export type ModalityId =
  | "barbell"
  | "dumbbell"
  | "bodyweight"
  | "band"
  | "machine";

export type EquipmentId =
  | "rack"
  | "spotter_arms"
  | "pull_up_bar"
  | "dip_bars"
  | "ohio_bar"
  | "bella_bar"
  | "plates"
  | "dumbbells"
  | "bench"
  | "bench_incline"
  | "bench_decline"
  | "monster_bands"
  | "hip_bands"
  | "floor";

export type BandId =
  | "band_orange"
  | "band_red"
  | "band_blue"
  | "band_green"
  | "hip_band_small"
  | "hip_band_medium";

/** Exercises live in the database now (authored at /exercises), so ids are
 *  open strings — the readable-slug convention still applies ("squat",
 *  "ex_cable_row_a1b2"). Validated at write time via `assertExerciseIds`,
 *  not a compile-time union. */
export type ExerciseId = string;

/** Clients live in the database now (migration 002), so ids are open
 *  strings — the readable-slug convention still applies (`c_maria_x1`). */
export type ClientId = string;

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

/** Broad movement classification. `isolation` covers single-joint accessory
 *  work; `mobility` is deliberately excluded from all volume math. */
export type MovementPattern =
  | "squat"
  | "hinge"
  | "lunge"
  | "push_h"
  | "push_v"
  | "pull_h"
  | "pull_v"
  | "carry"
  | "core"
  | "isolation"
  | "mobility";

/** What the reps column means for this exercise. */
export type MetricType = "reps" | "time" | "distance";

/**
 * How trustworthy a recorded load is.
 * - `exact`       — a real number (plates, dumbbells)
 * - `approximate` — a published range (monster loop bands)
 * - `ordinal`     — rank only, no magnitude (hip bands). Never do arithmetic
 *                   on ordinal loads: no e1RM, no percentage change.
 */
export type LoadPrecision = "exact" | "approximate" | "ordinal";

/** A band can add load or take it away (assisted pull-ups / dips). */
export type BandRole = "resistance" | "assistance";

export type UnilateralMode = "bilateral" | "alternating" | "single_side";

export type ExperienceLevel = "beginner" | "intermediate" | "advanced";

/** End-of-session self-report of how the body felt, independent of effort —
 *  "moving weight slower than when rested" is a condition signal, not an RPE
 *  signal. Kept separate so a tired-but-easy day and a fresh-but-brutal day
 *  don't collapse into one number. */
export type SessionCondition = "rough" | "tired" | "normal" | "good" | "great";

export type Goal = "general-fitness" | "strength" | "hypertrophy" | "fat-loss";

// ---------------------------------------------------------------------------
// Taxonomy
// ---------------------------------------------------------------------------

export type MuscleGroup = {
  id: MuscleGroupId;
  label: string;
  order: number;
};

export type Muscle = {
  id: MuscleId;
  name: string;
  groupId: MuscleGroupId;
};

// ---------------------------------------------------------------------------
// Equipment inventory
// ---------------------------------------------------------------------------

export type Equipment = {
  id: EquipmentId;
  name: string;
  owned: boolean;
};

export type Bar = {
  id: Extract<EquipmentId, "ohio_bar" | "bella_bar">;
  name: string;
  weightLbs: number;
};

/** `pairs` is how many matched pairs you own, i.e. how many of this size are
 *  available per side. One data edit here re-derives every loadable weight. */
export type PlatePair = {
  weightLbs: number;
  pairs: number;
};

export type DumbbellPair = {
  /** Weight of a single dumbbell. Total moved is this times implements used. */
  weightLbs: number;
};

/** Rogue Monster loop bands: tension is a range, not a point value, because it
 *  rises with stretch. Anchored by wrapping a rack upright. */
export type LoopBand = {
  id: BandId;
  family: "monster";
  label: string;
  model: string;
  minLbs: number;
  maxLbs: number;
};

/** Rogue woven hip bands: no published lb value exists, so difficulty is
 *  ordinal. `sizeInches` is the single source of truth — SMALLER IS HARDER, so
 *  rank is derived by sorting ascending. Never store a parallel intensity
 *  string; it drifts out of sync the moment a band is added. */
export type HipBand = {
  id: BandId;
  family: "hip";
  label: string;
  sizeInches: number;
};

export type Band = LoopBand | HipBand;

// ---------------------------------------------------------------------------
// Modalities — how an exercise is loaded
// ---------------------------------------------------------------------------

export type MuscleModifier = {
  muscleId: MuscleId;
  /** Added to the exercise's base score, then clamped to 0-10. */
  delta: number;
};

/**
 * `seedLoadFactor` is a seeded coaching heuristic, not a measurement. The
 * direction is well supported (dumbbell pressing lands ~80-90% of barbell)
 * but no published figure transfers cleanly to one lifter on one lift, so
 * it's a placeholder that `deriveLoadFactor()` replaces with the client's
 * own measured ratio.
 */
export type Modality = {
  id: ModalityId;
  name: string;
  owned: boolean;
  /** Load equivalence against a barbell baseline of 1.00. `null` where the
   *  concept doesn't apply (bodyweight, bands). */
  seedLoadFactor: number | null;
  muscleModifiers: readonly MuscleModifier[];
};

// ---------------------------------------------------------------------------
// Exercises
// ---------------------------------------------------------------------------

/**
 * The generic movement. Deliberately has no `muscleGroup` field — the primary
 * muscle and group are derived from `exerciseMuscleScores`, so they cannot
 * disagree with it. How load is expressed comes from the modality, not here.
 */
export type Exercise = {
  id: ExerciseId;
  name: string;
  /** Alternative names for the same movement ("Overhead Press" for Shoulder
   *  Press). Searched by the picker and checked by the duplicate guard;
   *  absent means none. */
  aliases?: readonly string[];
  pattern: MovementPattern;
  metricType: MetricType;
  isCompound: boolean;
};

/** Authored once per exercise. The modality adjusts these; it does not
 *  re-author them. Scale: 10 = primary mover, 6-8 = strong secondary,
 *  3-5 = supporting, 1-2 = stabilizer. */
export type ExerciseMuscleScore = {
  exerciseId: ExerciseId;
  muscleId: MuscleId;
  score: number;
};

/** An exercise × modality pair — a "variant" in the UI. */
export type ExerciseModality = {
  exerciseId: ExerciseId;
  modalityId: ModalityId;
  isDefault: boolean;
  /** Which band roles are valid here. Only meaningful when modalityId is
   *  'band'. `pull_up` is assistance-only; `bicep_curl` is resistance-only. */
  bandRoles: readonly BandRole[];
  defaultUnilateralMode: UnilateralMode;
  requiredEquipment: readonly EquipmentId[];
  /**
   * True when failing a rep can trap you under the load (barbell squat, bench).
   * Kept separate from `requiredEquipment` on purpose: spotter arms are not
   * needed to *perform* the lift, only to fail it safely. `allowsFailure()`
   * combines this with what you own to decide whether an RIR 0-1 prescription
   * is reasonable for a solo session.
   */
  pinRisk: boolean;
  /** Set only where this pair deviates from the modality's seed factor. */
  loadFactorOverride: number | null;
  notes: string;
};

// ---------------------------------------------------------------------------
// People
// ---------------------------------------------------------------------------

/**
 * `dateOfBirth` is stored rather than age so it never goes stale.
 * Bodyweight deliberately lives in `weighIns`, not here — storing "the most
 * recent weigh-in" on the profile overwrites history and kills both bodyweight
 * trends and relative-strength stats.
 */
export type Client = {
  id: ClientId;
  firstName: string;
  lastName: string;
  status: "active" | "inactive";
  joinDate: string;
  dateOfBirth: string;
  heightInches: number;
  experienceLevel: ExperienceLevel;
  goal: Goal;
  /** True for you. Clients are records you manage, not users who log in. */
  isTrainer: boolean;
  /** Preset swatch hex for this person's group-board card outline, or null. */
  color: string | null;
  notes: string;
};

export type WeighIn = {
  id: string;
  clientId: ClientId;
  date: string;
  bodyweightLbs: number;
};

// ---------------------------------------------------------------------------
// Nutrition
// ---------------------------------------------------------------------------

/** Generic per-plate density classes for the plate-fraction estimator. */
export type FoodCategoryId =
  | "lean_protein"
  | "fatty_protein"
  | "starchy_carb"
  | "veggie"
  | "fruit"
  | "fried_fatty"
  | "dessert"
  | "dairy"
  | "drink";

/**
 * kcal/macros for a FULL single-layer 10 1/16" Dixie plate of a typical food
 * in this class (drinks: a full 12 oz glass). Rough coaching estimates in the
 * same spirit as `seedLoadFactor` — honest directionally, not lab numbers.
 */
export type FoodCategory = {
  id: FoodCategoryId;
  label: string;
  plateKcal: number;
  plateProteinG: number;
  plateCarbsG: number;
  plateFatG: number;
};

/** A named food in the household catalog (DB). Values are per FULL plate;
 *  logs scale them by the covered fraction. */
export type Food = {
  id: string;
  name: string;
  category: FoodCategoryId;
  plateKcal: number;
  plateProteinG: number;
  plateCarbsG: number;
  plateFatG: number;
};

/** One logged food. kcal/macros are snapshotted at log time so later edits
 *  to the food never rewrite eating history. */
export type FoodLog = {
  id: string;
  clientId: ClientId;
  date: string;
  foodId: string;
  /** Fraction of the plate covered, (0, 1]. */
  plateFraction: number;
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
};

// ---------------------------------------------------------------------------
// Logged work
// ---------------------------------------------------------------------------

export type Session = {
  id: string;
  clientId: ClientId;
  date: string;
  /** Set when this session came from an assigned program day. */
  assignmentId: string | null;
  routineId: string | null;
  durationMinutes: number | null;
  /** Session RPE 1-10, self-reported at finish. Optional. */
  rpe: number | null;
  condition: SessionCondition | null;
  status: "planned" | "completed" | "skipped";
  notes: string;
};

/**
 * One row per set. Carries its own `modalityId`, which is what lets you switch
 * from barbell to dumbbells mid-session and have both sets recorded faithfully
 * rather than looking like duplicate rows.
 */
export type SetLog = {
  id: string;
  sessionId: string;
  exerciseId: ExerciseId;
  modalityId: ModalityId;
  /** Performed order across the whole session, 1-based. Grouping consecutive
   *  sets into exercise blocks is only defined if this survives storage —
   *  array insertion order does not round-trip through a database. */
  position: number;
  /** Ordering within the exercise, 1-based. */
  setNumber: number;
  unilateralMode: UnilateralMode;
  side: "left" | "right" | null;
  /** ALWAYS PER SIDE. Total reps are derived. This is the single most common
   *  source of corrupt volume data ("3x10 Bulgarians" meaning 30 or 60). */
  reps: number | null;
  /** Per implement, not total. A 55 lb dumbbell in each hand is 55 here; the
   *  110 lb total is derived from `unilateralMode`. */
  weightLbs: number | null;
  /** Extra load hung from a bodyweight movement (weighted pull-up, dip). */
  addedWeightLbs: number | null;
  bandId: BandId | null;
  bandRole: BandRole | null;
  durationSeconds: number | null;
  distanceFeet: number | null;
  /** Reps in reserve. 0 means taken to failure. */
  rir: number | null;
  isWarmup: boolean;
  completed: boolean;
  notes: string;
};

// ---------------------------------------------------------------------------
// Programming
// ---------------------------------------------------------------------------

export type Routine = {
  id: string;
  name: string;
  notes: string;
};

/**
 * A routine entry must pin a modality — "Bicep Curl 3x12" is not a
 * prescription until it says which implement.
 */
export type RoutineExercise = {
  routineId: string;
  order: number;
  exerciseId: ExerciseId;
  modalityId: ModalityId;
  bandRole: BandRole | null;
  unilateralMode: UnilateralMode;
  sets: number;
  repMin: number | null;
  repMax: number | null;
  durationSeconds: number | null;
  restSeconds: number;
  targetRir: number | null;
  /** Shared label pairs exercises into a superset. */
  supersetGroup: string | null;
  notes: string;
};

export type Program = {
  id: string;
  name: string;
  weeks: number;
  notes: string;
};

export type ProgramDay = {
  programId: string;
  /** 1-based. */
  week: number;
  /** 1 = Monday .. 7 = Sunday. */
  dayOfWeek: number;
  routineId: string;
};

export type Assignment = {
  id: string;
  programId: string;
  clientId: ClientId;
  startDate: string;
  status: "active" | "completed" | "paused";
};
