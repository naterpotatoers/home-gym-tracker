"use server";

import { redirect } from "next/navigation";
import {
  builtInDriftFromRows,
  builtInRoutineRows,
  builtInRoutines,
  builtInRowsFor,
} from "../built-in-routines";
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

/** The built-in finishers' current live state — only their own routines
 *  and rows, shaped for builtInRoutineDrift. */
async function liveBuiltIns(label: string) {
  const ids = builtInRoutines.map((r) => r.id);
  const [routines, rows] = await Promise.all([
    run(label, supabase.from("routines").select("*").in("id", ids)),
    run(label, supabase.from("routine_exercises").select("*").in("routine_id", ids)),
  ]);
  return builtInDriftFromRows((routines ?? []).map(rowToRoutine), (rows ?? []).map(rowToRoutineExercise));
}

async function assertBuiltInExercises(): Promise<void> {
  try {
    await assertExerciseIds(builtInRoutineRows.map((row) => row.exerciseId));
  } catch (e) {
    throw new Error(
      `${errorMessage(e, "unknown exercise")} — the built-in finishers reference the ` +
        "newest catalog exercises; import/re-import the seed catalog at /exercises first.",
    );
  }
}

/**
 * Add the built-in Care and Core finishers (src/lib/data/care-routines.ts,
 * core-routines.ts) the live DB doesn't have yet. Add-only: a routine whose
 * id exists is left alone here — updateBuiltInRoutines is the explicit
 * overwrite. (Deliberately NOT a row-level ignoreDuplicates upsert: the row
 * PK is (routine_id, sort_order) and saveRoutine renumbers, so stale seed
 * rows could interleave into an edited routine.)
 */
export async function addBuiltInRoutines(): Promise<void> {
  await assertBuiltInExercises();
  const { missing } = await liveBuiltIns("adding built-in finishers");
  for (const routine of missing) {
    await writeRoutine("adding built-in finishers", routine, builtInRowsFor(routine.id), true);
  }
  if (missing.length > 0) revalidateAll();
}

/**
 * Overwrite built-in finishers that drifted from the shipped version (an
 * older seed, or hand edits) with the current rows — name, notes and every
 * row, each routine one all-or-nothing save_routine. The /programs button
 * confirms first, since edits to built-ins are lost.
 */
export async function updateBuiltInRoutines(): Promise<void> {
  await assertBuiltInExercises();
  const { changed } = await liveBuiltIns("updating built-in finishers");
  for (const routine of changed) {
    await writeRoutine("updating built-in finishers", routine, builtInRowsFor(routine.id), false);
  }
  if (changed.length > 0) revalidateAll();
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
