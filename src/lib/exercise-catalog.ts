import { nameKey } from "./names";
import type {
  Exercise,
  ExerciseModality,
  ExerciseMuscleScore,
  MetricType,
  MovementPattern,
} from "./types";

/**
 * The exercise catalog as it crosses the server→client boundary: three plain
 * arrays (Maps don't serialize). `GymData` structurally satisfies this, so
 * pure functions typed against `ExerciseCatalog` accept a full snapshot too.
 */
export type ExerciseCatalog = {
  exercises: readonly Exercise[];
  exerciseMuscleScores: readonly ExerciseMuscleScore[];
  exerciseModalities: readonly ExerciseModality[];
};

export type ExerciseLookup = {
  exerciseById: ReadonlyMap<string, Exercise>;
  scoresByExercise: ReadonlyMap<string, ExerciseMuscleScore[]>;
  modalitiesByExercise: ReadonlyMap<string, ExerciseModality[]>;
};

/** Just the three catalog arrays — what server pages pass to client
 *  components. Never pass a full GymData across the boundary: it would
 *  serialize every session and set log with it. */
export function catalogSlice(data: ExerciseCatalog): ExerciseCatalog {
  return {
    exercises: data.exercises,
    exerciseMuscleScores: data.exerciseMuscleScores,
    exerciseModalities: data.exerciseModalities,
  };
}

const lookupCache = new WeakMap<ExerciseCatalog, ExerciseLookup>();

/** Lookup maps for a catalog, cached on the catalog's object identity so
 *  per-render calls in client components don't rebuild them. */
export function exerciseLookup(catalog: ExerciseCatalog): ExerciseLookup {
  const cached = lookupCache.get(catalog);
  if (cached) return cached;
  const lookup: ExerciseLookup = {
    exerciseById: new Map(catalog.exercises.map((e) => [e.id, e])),
    scoresByExercise: groupBy(catalog.exerciseMuscleScores, (r) => r.exerciseId),
    modalitiesByExercise: groupBy(catalog.exerciseModalities, (r) => r.exerciseId),
  };
  lookupCache.set(catalog, lookup);
  return lookup;
}

export function groupBy<T, K>(rows: readonly T[], key: (row: T) => K): Map<K, T[]> {
  const out = new Map<K, T[]>();
  for (const row of rows) {
    const k = key(row);
    const existing = out.get(k);
    if (existing) existing.push(row);
    else out.set(k, [row]);
  }
  return out;
}

/** Display labels for movement patterns — shared by the exercise picker and
 *  the /exercises catalog page. Record over the union: adding a pattern
 *  without a label is a compile error. */
export const PATTERN_LABELS: Record<MovementPattern, string> = {
  squat: "Squat",
  hinge: "Hinge",
  lunge: "Lunge",
  push_h: "Horizontal Push",
  push_v: "Vertical Push",
  pull_h: "Horizontal Pull",
  pull_v: "Vertical Pull",
  carry: "Carry",
  core: "Core",
  isolation: "Isolation",
  mobility: "Mobility",
};

export const PATTERN_ORDER = Object.keys(PATTERN_LABELS) as MovementPattern[];

/** Display labels for metric types — same compile-error guarantee. */
export const METRIC_LABELS: Record<MetricType, string> = {
  reps: "Reps",
  time: "Time",
  distance: "Distance",
};

export const METRIC_ORDER = Object.keys(METRIC_LABELS) as MetricType[];

// ---------------------------------------------------------------------------
// Names and aliases — the duplicate guard (normalization lives in names.ts)
// ---------------------------------------------------------------------------

export const MAX_ALIASES = 8;

/** What the duplicate guard needs to know about an exercise — a full
 *  `Exercise` satisfies it, and so does a narrow `select id, name, aliases`. */
export type NamedExercise = Pick<Exercise, "id" | "name" | "aliases">;

/**
 * First exercise whose name or alias matches one of `candidateKeys`
 * (exercise-name keys). `excludeId` skips the exercise being renamed so its
 * own name doesn't count as a collision.
 */
export function findNameCollision(
  exercises: readonly NamedExercise[],
  candidateKeys: readonly string[],
  excludeId?: string,
): { exercise: NamedExercise; matched: string } | null {
  const wanted = new Set(candidateKeys);
  for (const exercise of exercises) {
    if (exercise.id === excludeId) continue;
    for (const known of [exercise.name, ...(exercise.aliases ?? [])]) {
      if (wanted.has(nameKey(known))) return { exercise, matched: known };
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Muscle-score roles — the authoring guardrail
// ---------------------------------------------------------------------------

/**
 * The /exercises editor authors scores as roles, not free 0–10 numbers, so a
 * hand-added exercise can't claim an inflated profile that skews the heat
 * map. Bounds mirror the seed catalog's reality (no seed exercise touches
 * more than 9 muscles or has more than 2 scores ≥ 9). Seed rows keep their
 * hand-tuned values; re-saving through the editor snaps them to role scores.
 */
export const SCORE_ROLES = [
  { role: "primary", label: "Primary", score: 10 },
  { role: "secondary", label: "Secondary", score: 7 },
  { role: "supporting", label: "Supporting", score: 4 },
  { role: "stabilizer", label: "Stabilizer", score: 2 },
] as const;

export type ScoreRole = (typeof SCORE_ROLES)[number]["role"];

export const ROLE_SCORES: ReadonlySet<number> = new Set(
  SCORE_ROLES.map((r) => r.score),
);

export const MAX_PRIMARY_MUSCLES = 2;
export const MAX_SCORED_MUSCLES = 9;

/** Nearest role for a stored score — how seed values render in the editor. */
export function roleForScore(score: number): ScoreRole {
  if (score >= 9) return "primary";
  if (score >= 6) return "secondary";
  if (score >= 3) return "supporting";
  return "stabilizer";
}

export function scoreForRole(role: ScoreRole): number {
  const entry = SCORE_ROLES.find((r) => r.role === role);
  return entry ? entry.score : 2;
}
