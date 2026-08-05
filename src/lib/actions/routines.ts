"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { supabase } from "../db/client";
import { routineExerciseToRow } from "../db/mappers";
import { slugId } from "../ids";
import type { RoutineExercise } from "../types";
import { isExerciseId, isModalityId } from "../validate";

export async function createRoutine(formData: FormData): Promise<void> {
  const name = String(formData.get("name") ?? "").trim();
  if (!name) throw new Error("Routine needs a name.");
  const id = slugId("r", name);
  const { error } = await supabase
    .from("routines")
    .insert({ id, name, notes: "" });
  if (error) throw new Error(`creating routine: ${error.message}`);
  revalidatePath("/", "layout");
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

  const { error: metaError } = await supabase
    .from("routines")
    .upsert({ id: routineId, name: meta.name.trim(), notes: meta.notes });
  if (metaError) throw new Error(`saving routine: ${metaError.message}`);

  const { error: deleteError } = await supabase
    .from("routine_exercises")
    .delete()
    .eq("routine_id", routineId);
  if (deleteError) throw new Error(`saving routine: ${deleteError.message}`);

  if (rows.length > 0) {
    const { error: insertError } = await supabase.from("routine_exercises").insert(
      rows.map((row, index) =>
        routineExerciseToRow({ ...row, routineId, order: index + 1 }),
      ),
    );
    if (insertError) throw new Error(`saving routine: ${insertError.message}`);
  }

  revalidatePath("/", "layout");
}

/** Copy a routine and its prescriptions — "Upper B" is usually "Upper A with
 *  two swaps", so starting from a copy beats rebuilding six rows by hand. */
export async function duplicateRoutine(routineId: string): Promise<void> {
  const { data: routine, error } = await supabase
    .from("routines")
    .select("*")
    .eq("id", routineId)
    .single();
  if (error || !routine) throw new Error(`duplicating routine: ${error?.message ?? "not found"}`);

  const { data: rows, error: rowsError } = await supabase
    .from("routine_exercises")
    .select("*")
    .eq("routine_id", routineId);
  if (rowsError) throw new Error(`duplicating routine: ${rowsError.message}`);

  const name = `${routine.name} (copy)`;
  const newRoutineId = slugId("r", name);
  const { error: insertError } = await supabase
    .from("routines")
    .insert({ id: newRoutineId, name, notes: routine.notes });
  if (insertError) throw new Error(`duplicating routine: ${insertError.message}`);

  if (rows && rows.length > 0) {
    const { error: rowsInsertError } = await supabase
      .from("routine_exercises")
      .insert(rows.map((row) => ({ ...row, routine_id: newRoutineId })));
    if (rowsInsertError) throw new Error(`duplicating routine: ${rowsInsertError.message}`);
  }

  revalidatePath("/", "layout");
  redirect(`/routines/${newRoutineId}`);
}

export async function deleteRoutine(routineId: string): Promise<void> {
  const { count, error: refError } = await supabase
    .from("program_days")
    .select("program_id", { count: "exact" })
    .eq("routine_id", routineId)
    .limit(1);
  if (refError) throw new Error(`deleting routine: ${refError.message}`);
  if ((count ?? 0) > 0) {
    throw new Error("Routine is scheduled in a program — remove it there first.");
  }

  const { error } = await supabase.from("routines").delete().eq("id", routineId);
  if (error) throw new Error(`deleting routine: ${error.message}`);
  revalidatePath("/", "layout");
  redirect("/routines");
}
