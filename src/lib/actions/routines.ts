"use server";

import { redirect } from "next/navigation";
import { supabase } from "../db/client";
import { routineExerciseToRow } from "../db/mappers";
import { slugId } from "../ids";
import type { RoutineExercise } from "../types";
import { isExerciseId, isModalityId } from "../validate";
import { assertNoRefs, revalidateAll, run } from "./_helpers";

export async function createRoutine(formData: FormData): Promise<void> {
  const name = String(formData.get("name") ?? "").trim();
  if (!name) throw new Error("Routine needs a name.");
  const id = slugId("r", name);
  await run("creating routine", supabase.from("routines").insert({ id, name, notes: "" }));
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
  for (const row of rows) {
    if (!isExerciseId(row.exerciseId)) throw new Error(`bad exercise id ${row.exerciseId}`);
    if (!isModalityId(row.modalityId)) throw new Error(`bad modality id ${row.modalityId}`);
  }

  await run(
    "saving routine",
    supabase
      .from("routines")
      .upsert({ id: routineId, name: meta.name.trim(), notes: meta.notes }),
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

export async function deleteRoutine(routineId: string): Promise<void> {
  await assertNoRefs(
    "program_days",
    "routine_id",
    routineId,
    "Routine is scheduled in a program — remove it there first.",
  );
  await run("deleting routine", supabase.from("routines").delete().eq("id", routineId));
  revalidateAll();
  redirect("/routines");
}
