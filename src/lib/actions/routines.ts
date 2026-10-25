"use server";

import { redirect } from "next/navigation";
import { careRoutineExercises, careRoutines } from "../data/care-routines";
import { supabase } from "../db/client";
import { routineExerciseToRow, routineToRow } from "../db/mappers";
import { slugId } from "../ids";
import type { RoutineExercise } from "../types";
import { isBandRole, isModalityId, isUnilateralMode } from "../validate";
import { assertNoRefs, revalidateAll, run, runMatched } from "./_helpers";
import { assertExerciseIds } from "./exercises";

export async function createRoutine(formData: FormData): Promise<void> {
  const name = String(formData.get("name") ?? "").trim();
  if (!name) throw new Error("Routine needs a name.");
  const id = slugId("r", name);
  await run(
    "creating routine",
    supabase.from("routines").insert(routineToRow({ id, name, notes: "" })),
  );
  revalidateAll();
  redirect(`/routines/${id}`);
}

/**
 * Whole-routine save: meta upsert plus delete-then-insert of the prescription
 * rows. Not transactional under PostgREST — a failure between the two steps
 * can lose rows. Accepted for a single-household app; the upgrade path is a
 * Postgres function called via .rpc().
 */
export async function saveRoutine(
  routineId: string,
  meta: { name: string; notes: string },
  rows: readonly RoutineExercise[],
): Promise<void> {
  if (!meta.name.trim()) throw new Error("Routine needs a name.");
  await assertExerciseIds(rows.map((row) => row.exerciseId));
  for (const row of rows) {
    if (!isModalityId(row.modalityId)) throw new Error(`bad modality id ${row.modalityId}`);
    if (row.bandRole !== null && !isBandRole(row.bandRole)) {
      throw new Error(`bad band role ${row.bandRole}`);
    }
    if (!isUnilateralMode(row.unilateralMode)) {
      throw new Error(`bad unilateral mode ${row.unilateralMode}`);
    }
    if (!Number.isInteger(row.sets) || row.sets < 1 || row.sets > 20) {
      throw new Error(`bad set count ${row.sets}`);
    }
    if (row.repMin !== null && row.repMax !== null && row.repMin > row.repMax) {
      throw new Error("Rep range minimum is above the maximum.");
    }
  }

  // An UPDATE, never an upsert: a debounced save that lands after the
  // routine was deleted must fail, not resurrect it.
  await runMatched(
    "saving routine",
    supabase
      .from("routines")
      .update({ name: meta.name.trim(), notes: meta.notes })
      .eq("id", routineId)
      .select("id"),
  );
  await run(
    "saving routine",
    supabase.from("routine_exercises").delete().eq("routine_id", routineId),
  );
  if (rows.length > 0) {
    await run(
      "saving routine",
      supabase.from("routine_exercises").insert(
        rows.map((row, index) =>
          routineExerciseToRow({ ...row, routineId, order: index + 1 }),
        ),
      ),
    );
  }

  revalidateAll();
}

/** Copy a routine and its prescriptions — "Upper B" is usually "Upper A with
 *  two swaps", so starting from a copy beats rebuilding six rows by hand. */
export async function duplicateRoutine(routineId: string): Promise<void> {
  const routine = await run(
    "duplicating routine",
    supabase.from("routines").select("*").eq("id", routineId).single(),
  );
  const rows = await run(
    "duplicating routine",
    supabase.from("routine_exercises").select("*").eq("routine_id", routineId),
  );

  const name = `${routine.name} (copy)`;
  const newRoutineId = slugId("r", name);
  await run(
    "duplicating routine",
    supabase.from("routines").insert({ id: newRoutineId, name, notes: routine.notes }),
  );
  if (rows && rows.length > 0) {
    await run(
      "duplicating routine",
      supabase
        .from("routine_exercises")
        .insert(rows.map((row) => ({ ...row, routine_id: newRoutineId }))),
    );
  }

  revalidateAll();
  redirect(`/routines/${newRoutineId}`);
}

/**
 * Add the pre-built "Care" routines (src/lib/data/care-routines.ts) to the
 * live DB. Add-only per routine: a care routine whose id already exists is
 * skipped entirely — never merged or overwritten — so user edits survive and
 * re-running after new care routines land imports just the new ones.
 * (Deliberately NOT a row-level ignoreDuplicates upsert: the row PK is
 * (routine_id, sort_order) and saveRoutine renumbers, so stale seed rows
 * could interleave into an edited routine.)
 */
export async function importCareRoutines(): Promise<void> {
  try {
    await assertExerciseIds(careRoutineExercises.map((row) => row.exerciseId));
  } catch (e) {
    throw new Error(
      `${e instanceof Error ? e.message : e} — the care routines reference the ` +
        "newest catalog exercises; import/re-import the seed catalog at /exercises first.",
    );
  }

  const careIds = careRoutines.map((r) => r.id);
  const { data, error } = await supabase
    .from("routines")
    .select("id")
    .in("id", careIds);
  if (error) throw new Error(`importing care routines: ${error.message}`);
  const present = new Set((data ?? []).map((row) => row.id));
  const missing = careRoutines.filter((r) => !present.has(r.id));
  if (missing.length === 0) return;

  await run(
    "importing care routines",
    supabase.from("routines").insert(missing.map(routineToRow)),
  );
  const missingIds = new Set(missing.map((r) => r.id));
  await run(
    "importing care routines",
    supabase.from("routine_exercises").insert(
      careRoutineExercises
        .filter((row) => missingIds.has(row.routineId))
        .map(routineExerciseToRow),
    ),
  );
  revalidateAll();
}

export async function deleteRoutine(routineId: string): Promise<void> {
  await assertNoRefs(
    "program_days",
    "routine_id",
    routineId,
    "Routine is scheduled in a program — remove it there first.",
  );
  await assertNoRefs(
    "sessions",
    "routine_id",
    routineId,
    "Routine has logged workouts — those keep pointing at it, so it can't be deleted.",
  );
  await run("deleting routine", supabase.from("routines").delete().eq("id", routineId));
  revalidateAll();
  redirect("/programs");
}
