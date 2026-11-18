"use server";

import { redirect } from "next/navigation";
import {
  exerciseModalities as seedExerciseModalities,
  exerciseMuscleScores as seedExerciseMuscleScores,
  exercises as seedExercises,
} from "../data/exercises";
import { supabase } from "../db/client";
import { assertExerciseIds, isMissingColumn, isMissingTable } from "../db/guards";
import {
  exerciseModalityToRow,
  exerciseMuscleScoreToRow,
  exerciseToRow,
} from "../db/mappers";
import { findNameCollision, type NamedExercise } from "../exercise-catalog";
import { slugId } from "../ids";
import { nameKey, normalizeName } from "../names";
import {
  exercisePayloadProblem,
  isMetricType,
  isMovementPattern,
  normalizeExercisePayload,
  type ExercisePayload,
} from "../validate";
import { assertNoRefs, revalidateAll, run, runOrDuplicate, rpc } from "./_helpers";

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
  if (isMissingTable(error)) {
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
  const clean = normalizeExercisePayload(payload);
  const problem = exercisePayloadProblem(clean);
  if (problem) throw new Error(problem);
  const { name, aliases, cues } = clean;
  // Covers renames and new aliases; excludeId lets an exercise keep its own
  // name/aliases on every save.
  await assertNameAvailable(
    [nameKey(name), ...aliases.map(nameKey)],
    exerciseId,
  );

  // Row, scores, and variants in one transaction — a failure can't leave an
  // exercise stripped of its muscles or variants.
  await rpc(
    "saving exercise",
    "save_exercise",
    {
      p_exercise: exerciseToRow({
        id: exerciseId,
        name,
        aliases,
        pattern: payload.pattern,
        metricType: payload.metricType,
        isCompound: payload.isCompound,
      }),
      p_scores: payload.scores.map((row) => exerciseMuscleScoreToRow({ exerciseId, ...row })),
      p_modalities: payload.modalities.map((variant) =>
        exerciseModalityToRow({ exerciseId, ...variant }),
      ),
      p_cues: cues,
    },
    `"${name}" is already in the catalog — edit that exercise instead.`,
  );

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
 * catalog into the database. Add-only, per EXERCISE: a seed exercise whose id
 * already exists is skipped entirely — its scores and variants included — so
 * rows you've edited (a removed variant, a different default) are never
 * reverted, and re-running after new seed exercises land in
 * src/lib/data/exercises.ts adds just the new ones. A seed exercise whose name
 * a custom exercise already uses is skipped too (the lower(name) index would
 * reject it; the custom one stands in for it).
 */
export async function importSeedExercises(): Promise<void> {
  await importMissingSeedExercises();
  revalidateAll();
}

/** The import itself; returns the seed ids that exist after it ran. */
async function importMissingSeedExercises(): Promise<Set<string>> {
  const existing = await run(
    "importing exercises",
    supabase.from("exercises").select("id, name"),
  );
  const presentIds = new Set((existing ?? []).map((row) => row.id as string));
  const takenNames = new Set(
    (existing ?? []).map((row) => (row.name as string).toLowerCase()),
  );
  const missing = seedExercises.filter(
    (e) => !presentIds.has(e.id) && !takenNames.has(e.name.toLowerCase()),
  );
  const missingIds = new Set(missing.map((e) => e.id));

  if (missing.length > 0) {
    const { error } = await supabase.from("exercises").insert(missing.map(exerciseToRow));
    if (isMissingColumn(error)) throw new Error(CUES_MIGRATION_MESSAGE);
    if (error) throw new Error(`importing exercises: ${error.message}`);
    const scores = seedExerciseMuscleScores.filter((s) => missingIds.has(s.exerciseId));
    if (scores.length > 0) {
      await run(
        "importing muscle scores",
        supabase.from("exercise_muscle_scores").insert(scores.map(exerciseMuscleScoreToRow)),
      );
    }
    const variants = seedExerciseModalities.filter((em) => missingIds.has(em.exerciseId));
    if (variants.length > 0) {
      await run(
        "importing variants",
        supabase.from("exercise_modalities").insert(variants.map(exerciseModalityToRow)),
      );
    }
  }

  return new Set(
    seedExercises.filter((e) => presentIds.has(e.id) || missingIds.has(e.id)).map((e) => e.id),
  );
}

const CUES_MIGRATION_MESSAGE =
  "The exercises table has no cues column yet — run supabase/migrations/2026-11-18-exercise-cues.sql in the Supabase SQL editor.";

/**
 * Make the DB's built-in exercises match the CURRENT seed: first the same
 * add-only import as importSeedExercises (so built-ins added to the seed
 * after the first import — or ones you deleted — come back with their scores
 * and variants), then an overwrite of muscle scores, aliases and coaching
 * cues for every built-in. The explicit opt-in counterpart to importSeedExercises'
 * never-overwrite contract, for when the seed data itself gets corrected
 * (e.g. after a literature review). Deliberately narrow: names, patterns,
 * variants, and custom (non-seed-id) exercises are untouched.
 */
export async function resyncSeedCatalogScores(): Promise<void> {
  // Restore/add any missing built-ins first. This is what makes the button
  // sufficient on its own — the "Import seed catalog" card is only rendered
  // while the exercises table is EMPTY, so an already-imported DB has no
  // other way to receive newly added seed exercises.
  const seedIds = await importMissingSeedExercises();

  // Upsert the seed scores, then drop muscles the seed no longer lists —
  // never delete-all-then-insert, which would leave every built-in with no
  // scores (a blank heat map) if the insert failed.
  const seedScores = seedExerciseMuscleScores.filter((s) => seedIds.has(s.exerciseId));
  await run(
    "re-syncing seed scores",
    supabase
      .from("exercise_muscle_scores")
      .upsert(seedScores.map(exerciseMuscleScoreToRow), {
        onConflict: "exercise_id,muscle_id",
      }),
  );
  const keep = new Set(seedScores.map((s) => `${s.exerciseId}|${s.muscleId}`));
  const current = await run(
    "re-syncing seed scores",
    supabase
      .from("exercise_muscle_scores")
      .select("exercise_id, muscle_id")
      .in("exercise_id", [...seedIds]),
  );
  for (const row of current ?? []) {
    if (keep.has(`${row.exercise_id}|${row.muscle_id}`)) continue;
    await run(
      "re-syncing seed scores",
      supabase
        .from("exercise_muscle_scores")
        .delete()
        .eq("exercise_id", row.exercise_id)
        .eq("muscle_id", row.muscle_id),
    );
  }

  // Targeted alias + cue update per exercise — an upsert of the whole row
  // would also revert name/pattern edits, which stay the user's.
  for (const exercise of seedExercises) {
    if (!seedIds.has(exercise.id)) continue;
    const { error } = await supabase
      .from("exercises")
      .update({ aliases: [...(exercise.aliases ?? [])], cues: [...(exercise.cues ?? [])] })
      .eq("id", exercise.id);
    if (isMissingColumn(error)) throw new Error(CUES_MIGRATION_MESSAGE);
    if (error) throw new Error(`re-syncing seed aliases and cues: ${error.message}`);
  }
  revalidateAll();
}
