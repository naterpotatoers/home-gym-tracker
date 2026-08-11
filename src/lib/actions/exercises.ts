"use server";

import { redirect } from "next/navigation";
import {
  exerciseModalities as seedExerciseModalities,
  exerciseMuscleScores as seedExerciseMuscleScores,
  exercises as seedExercises,
} from "../data/exercises";
import { supabase } from "../db/client";
import {
  exerciseModalityToRow,
  exerciseMuscleScoreToRow,
  exerciseToRow,
} from "../db/mappers";
import {
  findNameCollision,
  MAX_ALIASES,
  MAX_PRIMARY_MUSCLES,
  MAX_SCORED_MUSCLES,
  ROLE_SCORES,
  scoreForRole,
  type NamedExercise,
} from "../exercise-catalog";
import { slugId } from "../ids";
import { nameKey, normalizeName } from "../names";
import type { ExerciseModality, MetricType, MovementPattern, MuscleId } from "../types";
import {
  isBandRole,
  isEquipmentId,
  isMetricType,
  isModalityId,
  isMovementPattern,
  isMuscleId,
  isUnilateralMode,
} from "../validate";
import { assertNoRefs, revalidateAll, run, runOrDuplicate } from "./_helpers";

/**
 * Exercise ids used to be a compile-time union; now they're rows, so actions
 * that take them verify existence before writing. Batched: one query for N
 * ids. Falls back to the TS seed set while the exercise tables don't exist
 * yet (PGRST205), mirroring the read-side fallback, so routine and set writes
 * keep working before the exercise tables exist in the DB.
 */
export async function assertExerciseIds(ids: Iterable<string>): Promise<void> {
  const unique = [...new Set(ids)];
  if (unique.length === 0) return;
  const { data, error } = await supabase
    .from("exercises")
    .select("id")
    .in("id", unique);
  if (error?.code === "PGRST205") {
    const seedIds = new Set<string>(seedExercises.map((e) => e.id));
    for (const id of unique) {
      if (!seedIds.has(id)) throw new Error(`bad exercise id ${id}`);
    }
    return;
  }
  if (error) throw new Error(`checking exercises: ${error.message}`);
  const found = new Set((data ?? []).map((row) => row.id));
  for (const id of unique) {
    if (!found.has(id)) throw new Error(`bad exercise id ${id}`);
  }
}

/**
 * The duplicate guard: throws when any of `keys` (exercise-name keys) is
 * already taken by another exercise's name or alias. Same seed fallback as
 * assertExerciseIds. The DB's lower(name) unique index still backstops the
 * name itself against a concurrent insert; aliases have no index, so this
 * check is their only guard.
 */
async function assertNameAvailable(
  keys: readonly string[],
  excludeId?: string,
): Promise<void> {
  const { data, error } = await supabase
    .from("exercises")
    .select("id, name, aliases");
  let catalog: readonly NamedExercise[];
  if (error?.code === "PGRST205") {
    catalog = seedExercises;
  } else if (error) {
    throw new Error(`checking exercise names: ${error.message}`);
  } else {
    catalog = (data ?? []).map((r) => ({
      id: r.id,
      name: r.name,
      aliases: r.aliases ?? [],
    }));
  }
  const hit = findNameCollision(catalog, keys, excludeId);
  if (!hit) return;
  const detail =
    nameKey(hit.matched) === nameKey(hit.exercise.name)
      ? `"${hit.exercise.name}" is already in the catalog`
      : `"${hit.matched}" is already in the catalog as "${hit.exercise.name}"`;
  throw new Error(`${detail} — edit that exercise instead.`);
}

/** Basics-only create from the /exercises add card; scores and variants are
 *  authored in the editor afterwards. */
export async function createExercise(formData: FormData): Promise<void> {
  const name = normalizeName(String(formData.get("name") ?? ""));
  if (!name) throw new Error("Exercise needs a name.");
  const pattern = String(formData.get("pattern") ?? "");
  if (!isMovementPattern(pattern)) throw new Error(`bad pattern ${pattern}`);
  const metricType = String(formData.get("metricType") ?? "");
  if (!isMetricType(metricType)) throw new Error(`bad metric type ${metricType}`);
  const isCompound = formData.get("isCompound") === "on";

  await assertNameAvailable([nameKey(name)]);

  const id = slugId("ex", name);
  // runOrDuplicate: the lower(name) index backstops a concurrent duplicate
  // with a readable message instead of a crash.
  await runOrDuplicate(
    "adding exercise",
    supabase.from("exercises").insert(
      exerciseToRow({ id, name, aliases: [], pattern, metricType, isCompound }),
    ),
    `"${name}" is already in the catalog — edit that exercise instead.`,
  );
  revalidateAll();
  redirect(`/exercises?exercise=${id}`);
}

export type ExercisePayload = {
  name: string;
  aliases: string[];
  pattern: MovementPattern;
  metricType: MetricType;
  isCompound: boolean;
  scores: { muscleId: MuscleId; score: number }[];
  modalities: Omit<ExerciseModality, "exerciseId">[];
};

function validatePayload(payload: ExercisePayload): void {
  if (!payload.name.trim()) throw new Error("Exercise needs a name.");
  if (!isMovementPattern(payload.pattern)) {
    throw new Error(`bad pattern ${payload.pattern}`);
  }
  if (!isMetricType(payload.metricType)) {
    throw new Error(`bad metric type ${payload.metricType}`);
  }

  if (payload.aliases.length > MAX_ALIASES) {
    throw new Error(`Too many aliases — ${MAX_ALIASES} at most.`);
  }
  const ownNameKey = nameKey(payload.name);
  const seenAliases = new Set<string>();
  for (const alias of payload.aliases) {
    const clean = normalizeName(alias);
    if (!clean) throw new Error("Aliases can't be empty.");
    if (clean.length > 60) {
      throw new Error(`Alias "${clean}" is too long — 60 characters at most.`);
    }
    const key = nameKey(clean);
    if (key === ownNameKey) {
      throw new Error(`"${clean}" is already the exercise's name.`);
    }
    if (seenAliases.has(key)) throw new Error(`duplicate alias ${clean}`);
    seenAliases.add(key);
  }

  // Muscle scores are authored as roles (see exercise-catalog.ts), which is
  // the guardrail against inflated profiles skewing the heat map. Zero rows
  // is fine — the mobility convention.
  if (payload.scores.length > MAX_SCORED_MUSCLES) {
    throw new Error(`Too many muscles — ${MAX_SCORED_MUSCLES} at most.`);
  }
  const seenMuscles = new Set<string>();
  let primaries = 0;
  for (const row of payload.scores) {
    if (!isMuscleId(row.muscleId)) throw new Error(`bad muscle id ${row.muscleId}`);
    if (seenMuscles.has(row.muscleId)) {
      throw new Error(`duplicate muscle ${row.muscleId}`);
    }
    seenMuscles.add(row.muscleId);
    if (!ROLE_SCORES.has(row.score)) {
      throw new Error(`bad score ${row.score} for ${row.muscleId} — use a role`);
    }
    if (row.score === scoreForRole("primary")) primaries += 1;
  }
  if (primaries > MAX_PRIMARY_MUSCLES) {
    throw new Error(`At most ${MAX_PRIMARY_MUSCLES} primary muscles.`);
  }

  const seenModalities = new Set<string>();
  let defaults = 0;
  for (const variant of payload.modalities) {
    if (!isModalityId(variant.modalityId)) {
      throw new Error(`bad modality id ${variant.modalityId}`);
    }
    if (seenModalities.has(variant.modalityId)) {
      throw new Error(`duplicate modality ${variant.modalityId}`);
    }
    seenModalities.add(variant.modalityId);
    if (!isUnilateralMode(variant.defaultUnilateralMode)) {
      throw new Error(`bad unilateral mode ${variant.defaultUnilateralMode}`);
    }
    for (const eq of variant.requiredEquipment) {
      if (!isEquipmentId(eq)) throw new Error(`bad equipment id ${eq}`);
    }
    for (const role of variant.bandRoles) {
      if (!isBandRole(role)) throw new Error(`bad band role ${role}`);
    }
    if (variant.bandRoles.length > 0 && variant.modalityId !== "band") {
      throw new Error("Band roles only apply to the band modality.");
    }
    if (
      variant.loadFactorOverride !== null &&
      !(variant.loadFactorOverride > 0 && variant.loadFactorOverride <= 3)
    ) {
      throw new Error("Load factor override must be between 0 and 3.");
    }
    if (variant.isDefault) defaults += 1;
  }
  if (payload.modalities.length > 0 && defaults !== 1) {
    throw new Error("Exactly one variant must be the default.");
  }
}

/**
 * Whole-exercise save: basics upsert plus delete-then-insert of the score and
 * variant rows. Not transactional under PostgREST — same accepted caveat as
 * saveRoutine; the upgrade path is a Postgres function via .rpc().
 */
export async function saveExercise(
  exerciseId: string,
  payload: ExercisePayload,
): Promise<void> {
  await assertExerciseIds([exerciseId]);
  validatePayload(payload);

  const name = normalizeName(payload.name);
  const aliases = payload.aliases.map(normalizeName);
  // Covers renames and new aliases; excludeId lets an exercise keep its own
  // name/aliases on every save.
  await assertNameAvailable(
    [nameKey(name), ...aliases.map(nameKey)],
    exerciseId,
  );

  await runOrDuplicate(
    "saving exercise",
    supabase.from("exercises").upsert(
      exerciseToRow({
        id: exerciseId,
        name,
        aliases,
        pattern: payload.pattern,
        metricType: payload.metricType,
        isCompound: payload.isCompound,
      }),
    ),
    `"${name}" is already in the catalog — edit that exercise instead.`,
  );
  await run(
    "saving exercise",
    supabase.from("exercise_muscle_scores").delete().eq("exercise_id", exerciseId),
  );
  if (payload.scores.length > 0) {
    await run(
      "saving exercise",
      supabase.from("exercise_muscle_scores").insert(
        payload.scores.map((row) =>
          exerciseMuscleScoreToRow({ exerciseId, ...row }),
        ),
      ),
    );
  }
  await run(
    "saving exercise",
    supabase.from("exercise_modalities").delete().eq("exercise_id", exerciseId),
  );
  if (payload.modalities.length > 0) {
    await run(
      "saving exercise",
      supabase.from("exercise_modalities").insert(
        payload.modalities.map((variant) =>
          exerciseModalityToRow({ exerciseId, ...variant }),
        ),
      ),
    );
  }

  revalidateAll();
}

export async function deleteExercise(exerciseId: string): Promise<void> {
  await assertNoRefs(
    "set_logs",
    "exercise_id",
    exerciseId,
    "This exercise has logged sets — it stays for history. (Remove its variants instead so it can't be picked.)",
  );
  await assertNoRefs(
    "routine_exercises",
    "exercise_id",
    exerciseId,
    "This exercise is prescribed in a routine — remove it there first.",
  );
  // Scores and variants cascade via their FKs.
  await run(
    "deleting exercise",
    supabase.from("exercises").delete().eq("id", exerciseId),
  );
  revalidateAll();
  redirect("/exercises");
}

/**
 * One-time (but idempotent and re-runnable) import of the TypeScript seed
 * catalog into the database — ON CONFLICT DO NOTHING, so rows you've edited
 * are never overwritten and re-running after new seed exercises land in
 * src/lib/data/exercises.ts adds just the new ones.
 */
export async function importSeedExercises(): Promise<void> {
  await run(
    "importing exercises",
    supabase
      .from("exercises")
      .upsert(seedExercises.map(exerciseToRow), { ignoreDuplicates: true }),
  );
  await run(
    "importing muscle scores",
    supabase
      .from("exercise_muscle_scores")
      .upsert(seedExerciseMuscleScores.map(exerciseMuscleScoreToRow), {
        ignoreDuplicates: true,
      }),
  );
  await run(
    "importing variants",
    supabase
      .from("exercise_modalities")
      .upsert(seedExerciseModalities.map(exerciseModalityToRow), {
        ignoreDuplicates: true,
      }),
  );
  revalidateAll();
}

/**
 * Make the DB's built-in exercises match the CURRENT seed: first the same
 * add-only upserts as importSeedExercises (so built-ins added to the seed
 * after the first import — or ones you deleted — come back with their scores
 * and variants), then an overwrite of muscle scores and aliases for every
 * built-in. The explicit opt-in counterpart to importSeedExercises'
 * never-overwrite contract, for when the seed data itself gets corrected
 * (e.g. after a literature review). Deliberately narrow: names, patterns,
 * variants, and custom (non-seed-id) exercises are untouched. Not
 * transactional under PostgREST — same caveat as saveExercise.
 */
export async function resyncSeedCatalogScores(): Promise<void> {
  // Restore/add any missing built-ins first. This is what makes the button
  // sufficient on its own — the "Import seed catalog" card is only rendered
  // while the exercises table is EMPTY, so an already-imported DB has no
  // other way to receive newly added seed exercises.
  await importSeedExercises();

  // Every seed id exists now, so the score overwrite is FK-safe.
  const seedIds = seedExercises.map((e) => e.id);
  await run(
    "re-syncing seed scores",
    supabase.from("exercise_muscle_scores").delete().in("exercise_id", seedIds),
  );
  await run(
    "re-syncing seed scores",
    supabase
      .from("exercise_muscle_scores")
      .insert(seedExerciseMuscleScores.map(exerciseMuscleScoreToRow)),
  );

  // Targeted alias update per exercise — an upsert of the whole row would
  // also revert name/pattern edits, which stay the user's.
  for (const exercise of seedExercises) {
    await run(
      "re-syncing seed aliases",
      supabase
        .from("exercises")
        .update({ aliases: [...(exercise.aliases ?? [])] })
        .eq("id", exercise.id),
    );
  }
  revalidateAll();
}
