"use server";

import { redirect } from "next/navigation";
import { supabase } from "../db/client";
import {
  assignmentToRow,
  programDayToRow,
  programToRow,
} from "../db/mappers";
import { newId, slugId } from "../ids";
import type { Assignment } from "../types";
import { isIsoDate, MAX_PROGRAM_WEEKS } from "../validate";
import { assertNoRefs, revalidateAll, run, runMatched } from "./_helpers";
import { assertClientId } from "./clients";

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

/** The program_days row shape, shared by every week-structure rewrite. */
function programDayRow(
  programId: string,
  week: number,
  d: { day_of_week: number; routine_id: string },
) {
  return {
    program_id: programId,
    week,
    day_of_week: d.day_of_week,
    routine_id: d.routine_id,
  };
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
  const newProgramId = slugId("p", name);
  await run(
    "duplicating program",
    supabase
      .from("programs")
      .insert({ id: newProgramId, name, weeks: program.weeks, notes: program.notes }),
  );
  if (days && days.length > 0) {
    await run(
      "duplicating program",
      supabase
        .from("program_days")
        .insert(days.map((d) => ({ ...d, program_id: newProgramId }))),
    );
  }

  revalidateAll();
  redirect(`/programs/${newProgramId}`);
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

/** Current week count plus that week's day rows — the shared read for the
 *  week-structure actions below. */
async function weekState(programId: string, week?: number) {
  const [program, days] = await Promise.all([
    run(
      "reading program",
      supabase.from("programs").select("weeks").eq("id", programId).single(),
    ),
    run(
      "reading program days",
      supabase.from("program_days").select("*").eq("program_id", programId),
    ),
  ]);
  const all = days ?? [];
  return {
    // .single() errors (and run throws) when the row is missing.
    weeks: program!.weeks as number,
    all,
    ofWeek: week === undefined ? [] : all.filter((d) => d.week === week),
  };
}

/** Append a week at the end — empty, or a copy of `copyFromWeek`'s layout. */
export async function addWeek(
  programId: string,
  copyFromWeek?: number,
): Promise<void> {
  const state = await weekState(programId, copyFromWeek);
  if (state.weeks >= MAX_PROGRAM_WEEKS) throw new Error(`Programs cap at ${MAX_PROGRAM_WEEKS} weeks.`);
  if (copyFromWeek !== undefined) assertWeek(copyFromWeek, state.weeks);
  const newWeek = state.weeks + 1;

  await run(
    "adding week",
    supabase.from("programs").update({ weeks: newWeek }).eq("id", programId),
  );
  if (state.ofWeek.length > 0) {
    await run(
      "adding week",
      supabase
        .from("program_days")
        .insert(state.ofWeek.map((d) => programDayRow(programId, newWeek, d))),
    );
  }
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

/** PostgREST's code for "function not found" — the migration hasn't run. */
const MISSING_FUNCTION = "PGRST202";

/** Week shifts run as one Postgres function (supabase/schema.sql) so a failure
 *  can't leave the schedule half-deleted — the composite PK forbids in-place
 *  shifts, and two client-side statements would not be atomic. */
async function rpcWeekShift(
  label: string,
  fn: "remove_program_week" | "duplicate_program_week",
  args: Record<string, unknown>,
): Promise<void> {
  const { error } = await supabase.rpc(fn, args);
  if (error?.code === MISSING_FUNCTION) {
    throw new Error(
      `${label}: database function ${fn} is missing — run supabase/migrations/2026-10-24-audit-fixes.sql in the Supabase SQL editor.`,
    );
  }
  if (error) throw new Error(`${label}: ${error.message}`);
}

/** Insert a copy of `week` directly after it, shifting later weeks down. */
export async function duplicateWeek(programId: string, week: number): Promise<void> {
  const state = await weekState(programId);
  if (state.weeks >= MAX_PROGRAM_WEEKS) throw new Error(`Programs cap at ${MAX_PROGRAM_WEEKS} weeks.`);
  assertWeek(week, state.weeks);
  await rpcWeekShift("duplicating week", "duplicate_program_week", {
    p_program: programId,
    p_week: week,
    p_max: MAX_PROGRAM_WEEKS,
  });
  revalidateAll();
}

/** Delete a week and close the gap; later weeks shift up. */
export async function removeWeek(programId: string, week: number): Promise<void> {
  const state = await weekState(programId);
  if (state.weeks <= 1) throw new Error("A program keeps at least one week.");
  assertWeek(week, state.weeks);
  await rpcWeekShift("removing week", "remove_program_week", {
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
  const { weeks } = await weekState(programId);
  assertWeek(week, weeks);
  assertDayOfWeek(dayOfWeek);
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
  const { weeks } = await weekState(programId);
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
 *  assignments are marked completed once the new one exists (insert first,
 *  so a failed insert never strands them with none). */
export async function createAssignment(formData: FormData): Promise<void> {
  const programId = String(formData.get("programId") ?? "");
  const clientId = String(formData.get("clientId") ?? "");
  const startDate = String(formData.get("startDate") ?? "");
  await assertClientId(clientId);
  if (!isIsoDate(startDate)) throw new Error("Pick a start date.");
  await weekState(programId); // throws when the program doesn't exist
  const id = newId("a");
  await run(
    "assigning program",
    supabase.from("assignments").insert(
      assignmentToRow({ id, programId, clientId, startDate, status: "active" }),
    ),
  );
  await run(
    "assigning program",
    supabase
      .from("assignments")
      .update({ status: "completed" })
      .eq("client_id", clientId)
      .eq("status", "active")
      .neq("id", id),
  );
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
  const row = await run(
    "updating assignment",
    supabase.from("assignments").select("client_id").eq("id", assignmentId).single(),
  );
  await runMatched(
    "updating assignment",
    supabase.from("assignments").update({ status }).eq("id", assignmentId).select("id"),
  );
  if (status === "active") {
    await run(
      "updating assignment",
      supabase
        .from("assignments")
        .update({ status: "completed" })
        // .single() threw above if the assignment is missing.
        .eq("client_id", row!.client_id)
        .eq("status", "active")
        .neq("id", assignmentId),
    );
  }
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
