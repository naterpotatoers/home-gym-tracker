import { CLIENT_COLORS } from "./data/clients";
import {
  MAX_ALIASES,
  MAX_CUE_LENGTH,
  MAX_CUES,
  MAX_PRIMARY_MUSCLES,
  MAX_SCORED_MUSCLES,
  ROLE_SCORES,
  scoreForRole,
} from "./exercise-catalog";
import { nameKey, normalizeName, parseCues } from "./names";
import { parseIntervalScheme } from "./conditioning";
import { parseDuration } from "./periods";
import { isRunKind } from "./running";
import { bandById, equipment } from "./data/equipment";
import type { ClientRow } from "./db/mappers";
import { foodCategories } from "./data/food-categories";
import { modalities } from "./data/modalities";
import { muscles } from "./data/muscles";
import type {
  BandId,
  BandRole,
  ConditioningTarget,
  EquipmentId,
  ExerciseModality,
  ExperienceLevel,
  FoodCategoryId,
  Goal,
  MetricType,
  ModalityId,
  MovementPattern,
  MuscleId,
  RoutineExercise,
  RunKind,
  SessionCondition,
  SetLog,
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
  "carry", "core", "isolation", "mobility", "conditioning",
];
const metricTypes: readonly MetricType[] = ["reps", "time", "distance"];
export const BAND_ROLES: readonly BandRole[] = ["resistance", "assistance"];
export const UNILATERAL_MODES: readonly UnilateralMode[] = [
  "bilateral", "alternating", "single_side",
];
/** Display labels — Records over the unions, so adding a member without a
 *  label is a compile error; the member lists derive from them. */
export const EXPERIENCE_LABELS: Record<ExperienceLevel, string> = {
  beginner: "Beginner",
  intermediate: "Intermediate",
  advanced: "Advanced",
};
export const EXPERIENCE_LEVELS = Object.keys(EXPERIENCE_LABELS) as ExperienceLevel[];
export const GOAL_LABELS: Record<Goal, string> = {
  "general-fitness": "General fitness",
  strength: "Strength",
  hypertrophy: "Hypertrophy",
  "fat-loss": "Fat loss",
};
export const GOALS = Object.keys(GOAL_LABELS) as Goal[];

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

function isBandId(id: string): id is BandId {
  return bandById.has(id as BandId);
}

function isCount(value: number | null, max: number): boolean {
  return value === null || (Number.isInteger(value) && value >= 0 && value <= max);
}

function isAmount(value: number | null, max: number): boolean {
  return value === null || (Number.isFinite(value) && value >= 0 && value <= max);
}

/**
 * Everything a SetLog write can get wrong that the database won't catch
 * (band_id is plain text; the numeric columns are unconstrained). Returns the
 * first problem, or null. Exercise ids are checked separately against the
 * live table.
 */
export function setLogProblem(set: SetLog): string | null {
  if (!isModalityId(set.modalityId)) return `bad modality id ${set.modalityId}`;
  if (!isUnilateralMode(set.unilateralMode)) return `bad unilateral mode ${set.unilateralMode}`;
  if (set.side !== null && set.side !== "left" && set.side !== "right") {
    return `bad side ${set.side}`;
  }
  if (set.bandId !== null && !isBandId(set.bandId)) return `bad band id ${set.bandId}`;
  if (set.bandRole !== null && !isBandRole(set.bandRole)) return `bad band role ${set.bandRole}`;
  if (!Number.isInteger(set.position) || set.position < 1) return `bad position ${set.position}`;
  if (!Number.isInteger(set.setNumber) || set.setNumber < 1) return `bad set number ${set.setNumber}`;
  if (!isCount(set.reps, 1000)) return `bad reps ${set.reps}`;
  if (!isCount(set.rir, 10)) return `bad RIR ${set.rir}`;
  if (!isAmount(set.weightLbs, 2000)) return `bad weight ${set.weightLbs}`;
  if (!isAmount(set.addedWeightLbs, 2000)) return `bad added weight ${set.addedWeightLbs}`;
  if (!isAmount(set.durationSeconds, 86_400)) return `bad duration ${set.durationSeconds}`;
  if (!isAmount(set.distanceFeet, 1_000_000)) return `bad distance ${set.distanceFeet}`;
  if (set.conditioning) {
    const c = set.conditioning;
    const problem = conditioningTargetProblem(c);
    if (problem) return problem;
    if (!isCount(c.avgWatts, 3000) || !isCount(c.maxWatts, 3000)) return "Watts must be 0–3000.";
    if (!isCount(c.avgRpm, 300)) return "RPM must be 0–300.";
    if (!isCount(c.calories, 5000)) return "Calories must be 0–5000.";
    if (c.effort != null && (!isCount(c.effort, 10) || c.effort < 1)) return "Effort must be 1–10.";
  }
  return null;
}

/** A conditioning target's rules — the same CHECKs the database enforces. */
function conditioningTargetProblem(t: ConditioningTarget): string | null {
  if (t.intervalScheme !== null && !parseIntervalScheme(t.intervalScheme)) {
    return `bad interval scheme ${t.intervalScheme}`;
  }
  if (t.targetWatts !== null && (!isCount(t.targetWatts, 2000) || t.targetWatts < 1)) {
    return "Target watts must be 1–2000.";
  }
  if (t.targetRpm !== null && (!isCount(t.targetRpm, 250) || t.targetRpm < 1)) {
    return "Target RPM must be 1–250.";
  }
  return null;
}

/**
 * Everything a routine prescription can get wrong that the database won't
 * catch (modality/band/unilateral ids are plain text; the numbers are
 * unconstrained ints). First problem or null. Exercise ids are checked
 * separately against the live table.
 */
export function routineExerciseProblem(row: RoutineExercise): string | null {
  if (!isModalityId(row.modalityId)) return `bad modality id ${row.modalityId}`;
  if (row.bandRole !== null && !isBandRole(row.bandRole)) return `bad band role ${row.bandRole}`;
  if (!isUnilateralMode(row.unilateralMode)) return `bad unilateral mode ${row.unilateralMode}`;
  if (!Number.isInteger(row.sets) || row.sets < 1 || row.sets > 20) return `bad set count ${row.sets}`;
  if (!isCount(row.repMin, 100) || !isCount(row.repMax, 100)) return "Reps must be 0–100.";
  if (row.repMin !== null && row.repMax !== null && row.repMin > row.repMax) {
    return "Rep range minimum is above the maximum.";
  }
  if (!isCount(row.durationSeconds, 3600)) return "Duration must be at most an hour.";
  if (!isCount(row.restSeconds, 1800)) return "Rest must be 0–30 minutes.";
  if (!isCount(row.targetRir, 10)) return "Target RIR must be 0–10.";
  if (row.supersetGroup !== null && (row.supersetGroup.length === 0 || row.supersetGroup.length > 20)) {
    return "Superset label must be 1–20 characters.";
  }
  if (row.conditioning) return conditioningTargetProblem(row.conditioning);
  return null;
}

/** Whole-list rules for a structural set sync: positions are the session's
 *  performed order, so they must be exactly 1..n with no duplicates (the DB
 *  enforces uniqueness too). Ids must be unique. */
export function setListProblem(sets: readonly Pick<SetLog, "id" | "position">[]): string | null {
  const ids = new Set(sets.map((s) => s.id));
  if (ids.size !== sets.length) return "duplicate set id";
  const positions = sets.map((s) => s.position).sort((a, b) => a - b);
  if (positions.some((p, i) => p !== i + 1)) return "set positions must run 1..n";
  return null;
}

/** Band work never carries pounds: its load comes from the band (a tension
 *  range, or rank only for hip bands). Strip any stray weight a modality swap
 *  left behind so ordinal work can't acquire a lbs value at write time.
 *  Ankle-weight work is the mirror case: the strapped weight is the load, so
 *  a stray band or added weight is dropped. */
export function normalizeSetLog(set: SetLog): SetLog {
  if (set.modalityId === "ankle_weight") {
    // The ankle weight IS the load: no band, no "added" weight on top.
    if (set.bandId === null && set.addedWeightLbs === null) return set;
    return { ...set, bandId: null, bandRole: null, addedWeightLbs: null };
  }
  if (set.modalityId !== "band") return set;
  if (set.weightLbs === null && set.addedWeightLbs === null) return set;
  return { ...set, weightLbs: null, addedWeightLbs: null };
}

// ---------------------------------------------------------------------------
// Form parsing — pure, so the actions stay thin and the rules stay testable
// ---------------------------------------------------------------------------

/** What a server action reads a form through — FormData satisfies it. */
export type FormFields = { get(name: string): FormDataEntryValue | null };

/** The launcher's "Bike warm-up" checkbox (src/lib/warmup.ts). */
export const BIKE_WARMUP_FIELD = "bike_warmup";

/** Checked → "on"; an unchecked checkbox is simply absent from the form. */
export function parseBikeWarmup(form: FormFields): boolean {
  return form.get(BIKE_WARMUP_FIELD) === "on";
}

export type RunForm = {
  date: string;
  distanceMiles: number;
  durationSeconds: number;
  kind: RunKind;
  notes: string;
};

/** The hand-log run form: miles + moving time ("42:07" / "1:05:20"); pace is
 *  derived, never stored. */
export function parseRunForm(form: FormFields): RunForm | { error: string } {
  const text = (name: string) => String(form.get(name) ?? "").trim();
  const date = text("date");
  const miles = Number(text("miles"));
  const durationSeconds = parseDuration(text("time"));
  const kind = text("kind") || "easy";
  if (!isIsoDate(date)) return { error: "Pick a valid date." };
  if (!Number.isFinite(miles) || miles <= 0 || miles > 200) {
    return { error: "Distance must be between 0 and 200 miles." };
  }
  if (durationSeconds === null || durationSeconds <= 0 || durationSeconds > 48 * 3600) {
    return { error: "Time looks off — use 42:07 or 1:05:20." };
  }
  if (!isRunKind(kind)) return { error: "Pick a run type." };
  return {
    date,
    distanceMiles: Math.round(miles * 100) / 100,
    durationSeconds,
    kind,
    notes: text("notes"),
  };
}

/** The editable profile columns, typed against ClientRow so the snake_case
 *  keys can't drift from the mapper/schema. */
export type ProfileRow = Pick<
  ClientRow,
  | "first_name"
  | "date_of_birth"
  | "height_inches"
  | "experience_level"
  | "goal"
  | "color"
  | "notes"
>;

const PRESET_COLORS = new Set<string>(CLIENT_COLORS.map((c) => c.hex));

/** Validate the profile form. Returns a user-facing message instead of
 *  throwing — the forms show it inline via useActionState. `currentColor`
 *  (the person's stored color) stays valid even when it isn't a preset. */
export function parseProfile(
  form: FormFields,
  currentColor: string | null = null,
): ProfileRow | { error: string } {
  const text = (name: string) => String(form.get(name) ?? "");
  const firstName = text("firstName").trim();
  const dateOfBirth = text("dateOfBirth");
  const heightInches = Number(form.get("heightInches") ?? 0);
  const experienceLevel = text("experienceLevel");
  const goal = text("goal");
  const color = text("color");
  const notes = text("notes").trim();

  if (!firstName) return { error: "A client needs a name." };
  if (!isIsoDate(dateOfBirth)) return { error: "Pick a date of birth." };
  if (!Number.isFinite(heightInches) || heightInches < 24 || heightInches > 96) {
    return { error: "Height must be between 24 and 96 inches." };
  }
  if (!isExperienceLevel(experienceLevel)) return { error: "Pick an experience level." };
  if (!isGoal(goal)) return { error: "Pick a goal." };
  if (color !== "" && !PRESET_COLORS.has(color) && color !== currentColor) {
    return { error: "Pick one of the preset colors." };
  }

  return {
    first_name: firstName,
    date_of_birth: dateOfBirth,
    height_inches: heightInches,
    experience_level: experienceLevel,
    goal,
    color: color || null,
    notes,
  };
}

/** The end-of-workout check-in. */
export type FinishPayload = {
  durationMinutes: number | null;
  notes: string;
  /** Session RPE 1-10, optional. */
  rpe: number | null;
  condition: SessionCondition | null;
};

export function finishProblem(payload: FinishPayload): string | null {
  const { rpe, condition, durationMinutes } = payload;
  if (rpe !== null && (!Number.isInteger(rpe) || rpe < 1 || rpe > 10)) return `bad rpe ${rpe}`;
  if (condition !== null && !isSessionCondition(condition)) return `bad condition ${condition}`;
  if (durationMinutes !== null && !isCount(durationMinutes, 24 * 60)) {
    return `bad duration ${durationMinutes}`;
  }
  return null;
}

/** An in-app path safe to redirect to — never another origin ("//evil",
 *  "https://…", "/\\evil"). */
export function isLocalPath(path: string): boolean {
  return path.startsWith("/") && !path.startsWith("//") && !path.startsWith("/\\");
}

// ---------------------------------------------------------------------------
// Exercise authoring
// ---------------------------------------------------------------------------

/** The /exercises editor's whole-exercise save. */
export type ExercisePayload = {
  name: string;
  aliases: string[];
  /** Coaching cues, in order — "Explain exercise". */
  cues: string[];
  pattern: MovementPattern;
  metricType: MetricType;
  isCompound: boolean;
  scores: { muscleId: MuscleId; score: number }[];
  modalities: Omit<ExerciseModality, "exerciseId">[];
};

/** What a save actually stores: name and aliases trimmed and
 *  single-spaced, cues cleaned and de-duplicated (parseCues). Validate this,
 *  not the raw payload — four typed cues with one repeat is three cues. */
export function normalizeExercisePayload(payload: ExercisePayload): ExercisePayload {
  return {
    ...payload,
    name: normalizeName(payload.name),
    aliases: payload.aliases.map(normalizeName),
    cues: parseCues(payload.cues),
  };
}

/**
 * Everything an exercise save can get wrong, as the first user-facing problem
 * or null — run it on normalizeExercisePayload's output. Muscle scores are authored as roles (see exercise-catalog.ts) —
 * the guardrail against inflated profiles skewing the heat map. Zero score
 * rows is fine (the mobility convention).
 */
export function exercisePayloadProblem(payload: ExercisePayload): string | null {
  if (!payload.name.trim()) return "Exercise needs a name.";
  if (!isMovementPattern(payload.pattern)) {
    return `bad pattern ${payload.pattern}`;
  }
  if (!isMetricType(payload.metricType)) {
    return `bad metric type ${payload.metricType}`;
  }

  if (payload.aliases.length > MAX_ALIASES) {
    return `Too many aliases — ${MAX_ALIASES} at most.`;
  }
  const ownNameKey = nameKey(payload.name);
  const seenAliases = new Set<string>();
  for (const alias of payload.aliases) {
    const clean = normalizeName(alias);
    if (!clean) return "Aliases can't be empty.";
    if (clean.length > 60) {
      return `Alias "${clean}" is too long — 60 characters at most.`;
    }
    const key = nameKey(clean);
    if (key === ownNameKey) {
      return `"${clean}" is already the exercise's name.`;
    }
    if (seenAliases.has(key)) return `duplicate alias ${clean}`;
    seenAliases.add(key);
  }

  if (payload.cues.length > MAX_CUES) return `Too many cues — ${MAX_CUES} at most.`;
  for (const cue of payload.cues) {
    if (cue.length > MAX_CUE_LENGTH) {
      return `Cue "${cue.slice(0, 24)}…" is too long — ${MAX_CUE_LENGTH} characters at most.`;
    }
  }

  if (payload.scores.length > MAX_SCORED_MUSCLES) {
    return `Too many muscles — ${MAX_SCORED_MUSCLES} at most.`;
  }
  const seenMuscles = new Set<string>();
  let primaries = 0;
  for (const row of payload.scores) {
    if (!isMuscleId(row.muscleId)) return `bad muscle id ${row.muscleId}`;
    if (seenMuscles.has(row.muscleId)) {
      return `duplicate muscle ${row.muscleId}`;
    }
    seenMuscles.add(row.muscleId);
    if (!ROLE_SCORES.has(row.score)) {
      return `bad score ${row.score} for ${row.muscleId} — use a role`;
    }
    if (row.score === scoreForRole("primary")) primaries += 1;
  }
  if (primaries > MAX_PRIMARY_MUSCLES) {
    return `At most ${MAX_PRIMARY_MUSCLES} primary muscles.`;
  }

  const seenModalities = new Set<string>();
  let defaults = 0;
  for (const variant of payload.modalities) {
    if (!isModalityId(variant.modalityId)) {
      return `bad modality id ${variant.modalityId}`;
    }
    if (seenModalities.has(variant.modalityId)) {
      return `duplicate modality ${variant.modalityId}`;
    }
    seenModalities.add(variant.modalityId);
    if (!isUnilateralMode(variant.defaultUnilateralMode)) {
      return `bad unilateral mode ${variant.defaultUnilateralMode}`;
    }
    for (const eq of variant.requiredEquipment) {
      if (!isEquipmentId(eq)) return `bad equipment id ${eq}`;
    }
    for (const role of variant.bandRoles) {
      if (!isBandRole(role)) return `bad band role ${role}`;
    }
    if (variant.bandRoles.length > 0 && variant.modalityId !== "band") {
      return "Band roles only apply to the band modality.";
    }
    if (
      variant.loadFactorOverride !== null &&
      !(variant.loadFactorOverride > 0 && variant.loadFactorOverride <= 3)
    ) {
      return "Load factor override must be between 0 and 3.";
    }
    if (variant.implements !== null && variant.implements !== 1 && variant.implements !== 2) {
      return `bad dumbbell count ${variant.implements}`;
    }
    if (
      (variant.implements !== null || variant.loadIncludesBodyweight) &&
      variant.modalityId !== "dumbbell"
    ) {
      return "Dumbbell count and +bodyweight only apply to the dumbbell modality.";
    }
    if (variant.isDefault) defaults += 1;
  }
  if (payload.modalities.length > 0 && defaults !== 1) {
    return "Exactly one variant must be the default.";
  }
  return null;
}
