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

export type ExerciseId =
  // squat
  | "squat"
  | "front_squat"
  | "goblet_squat"
  | "wide_stance_squat"
  | "bulgarian_split_squat"
  // hinge
  | "deadlift"
  | "romanian_deadlift"
  | "good_morning"
  | "back_extension"
  | "hip_thrust"
  | "glute_bridge"
  // lunge / unilateral legs
  | "lunge"
  | "side_lunge"
  | "step_up"
  // horizontal push
  | "bench_press"
  | "incline_bench_press"
  | "decline_bench_press"
  | "floor_press"
  | "push_up"
  | "chest_fly"
  // vertical push
  | "shoulder_press"
  | "dip"
  | "bench_dip"
  // horizontal pull
  | "bent_over_row"
  | "single_arm_row"
  | "chest_supported_row"
  | "face_pull"
  | "band_pull_apart"
  // vertical pull
  | "pull_up"
  | "chin_up"
  // isolation
  | "bicep_curl"
  | "hammer_curl"
  | "tricep_extension"
  | "lateral_raise"
  | "shrug"
  | "calf_raise"
  | "external_rotation"
  // carry
  | "farmer_carry"
  | "timed_carry"
  | "bar_hang"
  // core
  | "plank"
  | "side_plank"
  | "copenhagen_plank"
  | "pallof_press"
  | "hanging_knee_raise"
  | "hanging_leg_raise"
  | "lateral_walk"
  | "clam_shell"
  | "dead_bug"
  | "reverse_dead_bug"
  | "sit_up"
  | "hollow_hold"
  | "russian_twist"
  | "bicycle_crunch"
  | "mountain_climber"
  | "woodchopper"
  // mobility
  | "stretch";

export type ClientId = "lidia" | "gabriel" | "vivica" | "nate";

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

/** Where in the range of motion the movement is hardest.
 *  `ascending` (bands) is hardest at end range and easiest at the stretch —
 *  a drawback under bandRole 'resistance', an advantage under 'assistance'. */
export type ResistanceProfile =
  | "constant"
  | "ascending"
  | "descending"
  | "matched";

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
  loadPrecision: Extract<LoadPrecision, "approximate">;
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
  loadPrecision: Extract<LoadPrecision, "ordinal">;
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
 * Metrics are seeded coaching heuristics, not measurements. The directions are
 * well supported (bilateral deficit is real; dumbbell pressing lands ~80-90% of
 * barbell; band tension rises through range) but no published figure transfers
 * cleanly to one lifter on one lift. `seedLoadFactor` is a placeholder that
 * `deriveLoadFactor()` replaces with the client's own measured ratio.
 */
export type Modality = {
  id: ModalityId;
  name: string;
  owned: boolean;
  /** 0-10. Effort spent controlling the implement rather than moving load.
   *  This is why dumbbells at 135 feel harder than a bar at 135. */
  stabilityDemand: number;
  /** Load equivalence against a barbell baseline of 1.00. `null` where the
   *  concept doesn't apply (bodyweight, bands). */
  seedLoadFactor: number | null;
  /** 0-10. Available range and stretch at the bottom. */
  romQuality: number;
  resistanceProfile: ResistanceProfile;
  /** `null` for bands — precision comes from the specific band used, since
   *  loop bands and hip bands sit on different measurement scales. */
  defaultLoadPrecision: LoadPrecision | null;
  /** 0-10. Technique floor, for matching variants to experience level. */
  skillDemand: number;
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
  notes: string;
};

export type WeighIn = {
  id: string;
  clientId: ClientId;
  date: string;
  bodyweightLbs: number;
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
