"use server";

import { redirect } from "next/navigation";
import { careRoutineExercises, careRoutines } from "../data/care-routines";
import { supabase } from "../db/client";
import {
  routineExerciseToRow,
  routineToRow,
  rowToRoutine,
  rowToRoutineExercise,
} from "../db/mappers";
import { errorMessage } from "../format";
import { slugId } from "../ids";
import type { Routine, RoutineExercise } from "../types";
import { routineExerciseProblem } from "../validate";
import { assertNoRefs, revalidateAll, rpc, run } from "./_helpers";
import { assertExerciseIds } from "../db/guards";

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

/** Whole-routine save: meta update plus the full prescription list, in one
 *  transaction. An UPDATE of the routine, never an upsert — a debounced save
 *  landing after the routine was deleted must fail, not resurrect it. */
export async function saveRoutine(
  routineId: string,
  meta: { name: string; notes: string },
  rows: readonly RoutineExercise[],
): Promise<void> {
  if (!meta.name.trim()) throw new Error("Routine needs a name.");
  await assertExerciseIds(rows.map((row) => row.exerciseId));
  for (const row of rows) {
    const problem = routineExerciseProblem(row);
    if (problem) throw new Error(problem);
  }
  await writeRoutine("saving routine", { id: routineId, name: meta.name.trim(), notes: meta.notes }, rows);
  revalidateAll();
}

/** The routine row plus its prescriptions (renumbered 1..n) as one RPC;
 *  `create` inserts the routine instead of updating it. */
async function writeRoutine(
  label: string,
  routine: Routine,
  rows: readonly RoutineExercise[],
  create = false,
): Promise<void> {
  await rpc(label, "save_routine", {
    p_routine: routineToRow(routine),
    p_rows: rows.map((row, index) =>
      routineExerciseToRow({ ...row, routineId: routine.id, order: index + 1 }),
    ),
    p_create: create,
  });
}

/** Copy a routine and its prescriptions — "Upper B" is usually "Upper A with
 *  two swaps", so starting from a copy beats rebuilding six rows by hand. */
export async function duplicateRoutine(routineId: string): Promise<void> {
  const [routine, rows] = await Promise.all([
    run("duplicating routine", supabase.from("routines").select("*").eq("id", routineId).single()),
    run(
      "duplicating routine",
      supabase.from("routine_exercises").select("*").eq("routine_id", routineId).order("sort_order"),
    ),
  ]);
  const name = `${routine.name} (copy)`;
  const copy = { ...rowToRoutine(routine), id: slugId("r", name), name };
  await writeRoutine("duplicating routine", copy, (rows ?? []).map(rowToRoutineExercise), true);
  revalidateAll();
  redirect(`/routines/${copy.id}`);
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
      `${errorMessage(e, "unknown exercise")} — the care routines reference the ` +
        "newest catalog exercises; import/re-import the seed catalog at /exercises first.",
    );
  }

  const careIds = careRoutines.map((r) => r.id);
  const data = await run(
    "importing care routines",
    supabase.from("routines").select("id").in("id", careIds),
  );
  const present = new Set((data ?? []).map((row) => row.id));
  const missing = careRoutines.filter((r) => !present.has(r.id));
  if (missing.length === 0) return;

  for (const routine of missing) {
    await writeRoutine(
      "importing care routines",
      routine,
      careRoutineExercises.filter((row) => row.routineId === routine.id),
      true,
    );
  }
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
