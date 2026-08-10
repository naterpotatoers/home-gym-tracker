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
  MAX_PRIMARY_MUSCLES,
  MAX_SCORED_MUSCLES,
  ROLE_SCORES,
  scoreForRole,
} from "../exercise-catalog";
import { slugId } from "../ids";
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
import { assertNoRefs, revalidateAll, run } from "./_helpers";

/**
 * Exercise ids used to be a compile-time union; now they're rows, so actions
 * that take them verify existence before writing. Batched: one query for N
 * ids. Falls back to the TS seed set while the exercise tables don't exist
 * yet (PGRST205), mirroring the read-side fallback, so routine and set writes
 * keep working before apply_exercises.sql has run.
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

/** Basics-only create from the /exercises add card; scores and variants are
 *  authored in the editor afterwards. */
export async function createExercise(formData: FormData): Promise<void> {
  const name = String(formData.get("name") ?? "").trim();
  if (!name) throw new Error("Exercise needs a name.");
  const pattern = String(formData.get("pattern") ?? "");
  if (!isMovementPattern(pattern)) throw new Error(`bad pattern ${pattern}`);
  const metricType = String(formData.get("metricType") ?? "");
  if (!isMetricType(metricType)) throw new Error(`bad metric type ${metricType}`);
  const isCompound = formData.get("isCompound") === "on";

  const id = slugId("ex", name);
  await run(
    "adding exercise",
    supabase.from("exercises").insert(
      exerciseToRow({ id, name, pattern, metricType, isCompound }),
    ),
  );
  revalidateAll();
  redirect(`/exercises?exercise=${id}`);
}

export type ExercisePayload = {
  name: string;
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

  await run(
    "saving exercise",
    supabase.from("exercises").upsert(
      exerciseToRow({
        id: exerciseId,
        name: payload.name.trim(),
        pattern: payload.pattern,
        metricType: payload.metricType,
        isCompound: payload.isCompound,
      }),
    ),
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
