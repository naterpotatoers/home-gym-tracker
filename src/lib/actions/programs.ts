"use server";

import { redirect } from "next/navigation";
import { supabase } from "../db/client";
import { programDayToRow, programToRow, rowToProgram, rowToProgramDay } from "../db/mappers";
import { newId, slugId } from "../ids";
import { localTodayIso } from "../periods";
import type { Assignment } from "../types";
import { isIsoDate, MAX_PROGRAM_WEEKS } from "../validate";
import { assertNoRefs, revalidateAll, rpc, run, runMatched } from "./_helpers";
import { assertClientId } from "../db/guards";

export async function createProgram(formData: FormData): Promise<void> {
  const name = String(formData.get("name") ?? "").trim();
  if (!name) throw new Error("Program needs a name.");
  const id = slugId("p", name);
  // Programs start at one week; the editor grows them row by row.
  await run(
    "creating program",
    supabase.from("programs").insert(programToRow({ id, name, weeks: 1, notes: "" })),
  );
  revalidateAll();
  redirect(`/programs/${id}`);
}

/** Copy a program and its full week/day schedule — starting a new block is
 *  usually "last block with tweaks". */
export async function duplicateProgram(programId: string): Promise<void> {
  const [program, days] = await Promise.all([
    run(
      "duplicating program",
      supabase.from("programs").select("*").eq("id", programId).single(),
    ),
    run(
      "duplicating program",
      supabase.from("program_days").select("*").eq("program_id", programId),
    ),
  ]);

  const name = `${program.name} (copy)`;
  const copy = { ...rowToProgram(program), id: slugId("p", name), name };
  await run("duplicating program", supabase.from("programs").insert(programToRow(copy)));
  if (days && days.length > 0) {
    // A failure here leaves an empty copy, never a damaged original — the
    // user can delete it and retry.
    await run(
      "duplicating program",
      supabase
        .from("program_days")
        .insert(days.map((d) => programDayToRow({ ...rowToProgramDay(d), programId: copy.id }))),
    );
  }

  revalidateAll();
  redirect(`/programs/${copy.id}`);
}

export async function updateProgramInfo(
  programId: string,
  patch: { name: string; notes: string },
): Promise<void> {
  if (!patch.name.trim()) throw new Error("Program needs a name.");
  await runMatched(
    "updating program",
    supabase
      .from("programs")
      .update({ name: patch.name.trim(), notes: patch.notes })
      .eq("id", programId)
      .select("id"),
  );
  revalidateAll();
}

/** The program's week count — throws when the program doesn't exist
 *  (.single() errors on zero rows). */
async function programWeeks(programId: string): Promise<number> {
  const program = await run(
    "reading program",
    supabase.from("programs").select("weeks").eq("id", programId).single(),
  );
  return program!.weeks as number;
}

/** Append a week at the end — empty, or a copy of `copyFromWeek`'s layout.
 *  One transaction: the week count and the copied days move together. */
export async function addWeek(programId: string, copyFromWeek?: number): Promise<void> {
  await rpc("adding week", "add_program_week", {
    p_program: programId,
    p_copy_from: copyFromWeek ?? null,
    p_max: MAX_PROGRAM_WEEKS,
  });
  revalidateAll();
}

/** Weeks and days arrive from the client; refuse anything outside the
 *  program before it reaches a write. */
function assertWeek(week: number, weeks: number): void {
  if (!Number.isInteger(week) || week < 1 || week > weeks) {
    throw new Error(`Week ${week} is outside this program (1–${weeks}).`);
  }
}

function assertDayOfWeek(dayOfWeek: number): void {
  if (!Number.isInteger(dayOfWeek) || dayOfWeek < 1 || dayOfWeek > 7) {
    throw new Error(`bad day of week ${dayOfWeek}`);
  }
}

/** Insert a copy of `week` directly after it, shifting later weeks down. */
export async function duplicateWeek(programId: string, week: number): Promise<void> {
  const weeks = await programWeeks(programId);
  if (weeks >= MAX_PROGRAM_WEEKS) throw new Error(`Programs cap at ${MAX_PROGRAM_WEEKS} weeks.`);
  assertWeek(week, weeks);
  await rpc("duplicating week", "duplicate_program_week", {
    p_program: programId,
    p_week: week,
    p_max: MAX_PROGRAM_WEEKS,
  });
  revalidateAll();
}

/** Delete a week and close the gap; later weeks shift up. */
export async function removeWeek(programId: string, week: number): Promise<void> {
  const weeks = await programWeeks(programId);
  if (weeks <= 1) throw new Error("A program keeps at least one week.");
  assertWeek(week, weeks);
  await rpc("removing week", "remove_program_week", {
    p_program: programId,
    p_week: week,
  });
  revalidateAll();
}

export async function setProgramDay(
  programId: string,
  week: number,
  dayOfWeek: number,
  routineId: string,
): Promise<void> {
  const weeks = await programWeeks(programId);
  assertWeek(week, weeks);
  assertDayOfWeek(dayOfWeek);
  // routine_id has an FK, but a forged id should read as a message, not a
  // constraint violation.
  await run(
    "scheduling day",
    supabase.from("routines").select("id").eq("id", routineId).single(),
  ).catch(() => {
    throw new Error("That routine no longer exists.");
  });
  await run(
    "scheduling day",
    supabase
      .from("program_days")
      .upsert(programDayToRow({ programId, week, dayOfWeek, routineId })),
  );
  revalidateAll();
}

export async function clearProgramDay(
  programId: string,
  week: number,
  dayOfWeek: number,
): Promise<void> {
  const weeks = await programWeeks(programId);
  assertWeek(week, weeks);
  assertDayOfWeek(dayOfWeek);
  await run(
    "clearing day",
    supabase
      .from("program_days")
      .delete()
      .eq("program_id", programId)
      .eq("week", week)
      .eq("day_of_week", dayOfWeek),
  );
  revalidateAll();
}

export async function deleteProgram(programId: string): Promise<void> {
  await assertNoRefs(
    "assignments",
    "program_id",
    programId,
    "Program has assignments — remove those first.",
  );
  await run("deleting program", supabase.from("programs").delete().eq("id", programId));
  revalidateAll();
  redirect("/programs");
}

/** Assign a program. One active program per person: their other active
 *  assignments complete in the same transaction as the insert. */
export async function createAssignment(formData: FormData): Promise<void> {
  const programId = String(formData.get("programId") ?? "");
  const clientId = String(formData.get("clientId") ?? "");
  const startDate = String(formData.get("startDate") ?? "");
  await assign(programId, clientId, startDate);
}

/** Run a finished program again from week 1, starting today. The old
 *  assignment is completed (its logged sessions keep pointing at it). */
export async function restartAssignment(assignmentId: string): Promise<void> {
  const row = await run(
    "restarting program",
    supabase
      .from("assignments")
      .select("program_id, client_id")
      .eq("id", assignmentId)
      .single(),
  );
  await assign(row!.program_id, row!.client_id, localTodayIso());
}

async function assign(programId: string, clientId: string, startDate: string): Promise<void> {
  await assertClientId(clientId);
  if (!isIsoDate(startDate)) throw new Error("Pick a start date.");
  await programWeeks(programId); // throws when the program doesn't exist
  await rpc("assigning program", "assign_program", {
    p_id: newId("a"),
    p_program: programId,
    p_client: clientId,
    p_start: startDate,
  });
  revalidateAll();
}

const ASSIGNMENT_STATUSES: readonly Assignment["status"][] = ["active", "completed", "paused"];

/** Reactivating one assignment completes the person's other active ones —
 *  the same one-active-program rule createAssignment keeps. */
export async function updateAssignmentStatus(
  assignmentId: string,
  status: string,
): Promise<void> {
  if (!ASSIGNMENT_STATUSES.includes(status as Assignment["status"])) {
    throw new Error(`bad status ${status}`);
  }
  await rpc("updating assignment", "set_assignment_status", {
    p_id: assignmentId,
    p_status: status,
  });
  revalidateAll();
}

/** Remove an assignment made by mistake. Logged workouts keep pointing at
 *  it, so one with history can only be marked completed. */
export async function deleteAssignment(assignmentId: string): Promise<void> {
  await assertNoRefs(
    "sessions",
    "assignment_id",
    assignmentId,
    "This assignment has logged workouts — mark it completed instead.",
  );
  await run(
    "removing assignment",
    supabase.from("assignments").delete().eq("id", assignmentId),
  );
  revalidateAll();
}
