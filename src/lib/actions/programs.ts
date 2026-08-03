"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { supabase } from "../db/client";
import { newId, slugId } from "../ids";
import { assertClientId } from "./clients";

export async function createProgram(formData: FormData): Promise<void> {
  const name = String(formData.get("name") ?? "").trim();
  if (!name) throw new Error("Program needs a name.");
  const id = slugId("p", name);
  // Programs start at one week; the editor grows them row by row.
  const { error } = await supabase
    .from("programs")
    .insert({ id, name, weeks: 1, notes: "" });
  if (error) throw new Error(`creating program: ${error.message}`);
  revalidatePath("/", "layout");
  redirect(`/programs/${id}`);
}

export async function updateProgramInfo(
  programId: string,
  patch: { name: string; notes: string },
): Promise<void> {
  if (!patch.name.trim()) throw new Error("Program needs a name.");
  const { error } = await supabase
    .from("programs")
    .update({ name: patch.name.trim(), notes: patch.notes })
    .eq("id", programId);
  if (error) throw new Error(`updating program: ${error.message}`);
  revalidatePath("/", "layout");
}

/** Current week count plus that week's day rows — the shared read for the
 *  week-structure actions below. */
async function weekState(programId: string, week?: number) {
  const [{ data: program, error: programError }, { data: days, error: daysError }] =
    await Promise.all([
      supabase.from("programs").select("weeks").eq("id", programId).single(),
      supabase.from("program_days").select("*").eq("program_id", programId),
    ]);
  if (programError) throw new Error(`reading program: ${programError.message}`);
  if (daysError) throw new Error(`reading program days: ${daysError.message}`);
  const all = days ?? [];
  return {
    weeks: program.weeks as number,
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
  if (state.weeks >= 52) throw new Error("Programs cap at 52 weeks.");
  const newWeek = state.weeks + 1;

  const { error } = await supabase
    .from("programs")
    .update({ weeks: newWeek })
    .eq("id", programId);
  if (error) throw new Error(`adding week: ${error.message}`);

  if (state.ofWeek.length > 0) {
    const { error: copyError } = await supabase.from("program_days").insert(
      state.ofWeek.map((d) => ({
        program_id: programId,
        week: newWeek,
        day_of_week: d.day_of_week,
        routine_id: d.routine_id,
      })),
    );
    if (copyError) throw new Error(`adding week: ${copyError.message}`);
  }
  revalidatePath("/", "layout");
}

/** Insert a copy of `week` directly after it, shifting later weeks down. */
export async function duplicateWeek(programId: string, week: number): Promise<void> {
  const state = await weekState(programId, week);
  if (state.weeks >= 52) throw new Error("Programs cap at 52 weeks.");
  const later = state.all.filter((d) => d.week > week);

  // Rewrite: delete everything after the source week, then reinsert shifted
  // +1 with the duplicate in between. Two steps because the composite PK
  // (program_id, week, day_of_week) forbids in-place shifts.
  const { error: deleteError } = await supabase
    .from("program_days")
    .delete()
    .eq("program_id", programId)
    .gt("week", week);
  if (deleteError) throw new Error(`duplicating week: ${deleteError.message}`);

  const rows = [
    ...state.ofWeek.map((d) => ({
      program_id: programId,
      week: week + 1,
      day_of_week: d.day_of_week,
      routine_id: d.routine_id,
    })),
    ...later.map((d) => ({
      program_id: programId,
      week: d.week + 1,
      day_of_week: d.day_of_week,
      routine_id: d.routine_id,
    })),
  ];
  if (rows.length > 0) {
    const { error } = await supabase.from("program_days").insert(rows);
    if (error) throw new Error(`duplicating week: ${error.message}`);
  }

  const { error: weeksError } = await supabase
    .from("programs")
    .update({ weeks: state.weeks + 1 })
    .eq("id", programId);
  if (weeksError) throw new Error(`duplicating week: ${weeksError.message}`);
  revalidatePath("/", "layout");
}

/** Delete a week and close the gap; later weeks shift up. */
export async function removeWeek(programId: string, week: number): Promise<void> {
  const state = await weekState(programId);
  if (state.weeks <= 1) throw new Error("A program keeps at least one week.");
  const later = state.all.filter((d) => d.week > week);

  const { error: deleteError } = await supabase
    .from("program_days")
    .delete()
    .eq("program_id", programId)
    .gte("week", week);
  if (deleteError) throw new Error(`removing week: ${deleteError.message}`);

  if (later.length > 0) {
    const { error } = await supabase.from("program_days").insert(
      later.map((d) => ({
        program_id: programId,
        week: d.week - 1,
        day_of_week: d.day_of_week,
        routine_id: d.routine_id,
      })),
    );
    if (error) throw new Error(`removing week: ${error.message}`);
  }

  const { error: weeksError } = await supabase
    .from("programs")
    .update({ weeks: state.weeks - 1 })
    .eq("id", programId);
  if (weeksError) throw new Error(`removing week: ${weeksError.message}`);
  revalidatePath("/", "layout");
}

export async function setProgramDay(
  programId: string,
  week: number,
  dayOfWeek: number,
  routineId: string,
): Promise<void> {
  const { error } = await supabase.from("program_days").upsert({
    program_id: programId,
    week,
    day_of_week: dayOfWeek,
    routine_id: routineId,
  });
  if (error) throw new Error(`scheduling day: ${error.message}`);
  revalidatePath("/", "layout");
}

export async function clearProgramDay(
  programId: string,
  week: number,
  dayOfWeek: number,
): Promise<void> {
  const { error } = await supabase
    .from("program_days")
    .delete()
    .eq("program_id", programId)
    .eq("week", week)
    .eq("day_of_week", dayOfWeek);
  if (error) throw new Error(`clearing day: ${error.message}`);
  revalidatePath("/", "layout");
}

export async function deleteProgram(programId: string): Promise<void> {
  const { count, error: refError } = await supabase
    .from("assignments")
    .select("id", { count: "exact" })
    .eq("program_id", programId)
    .limit(1);
  if (refError) throw new Error(`deleting program: ${refError.message}`);
  if ((count ?? 0) > 0) {
    throw new Error("Program has assignments — remove those first.");
  }
  const { error } = await supabase.from("programs").delete().eq("id", programId);
  if (error) throw new Error(`deleting program: ${error.message}`);
  revalidatePath("/", "layout");
  redirect("/programs");
}

export async function createAssignment(formData: FormData): Promise<void> {
  const programId = String(formData.get("programId") ?? "");
  const clientId = String(formData.get("clientId") ?? "");
  const startDate = String(formData.get("startDate") ?? "");
  await assertClientId(clientId);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate)) throw new Error("Pick a start date.");
  const { error } = await supabase.from("assignments").insert({
    id: newId("a"),
    program_id: programId,
    client_id: clientId,
    start_date: startDate,
    status: "active",
  });
  if (error) throw new Error(`assigning program: ${error.message}`);
  revalidatePath("/", "layout");
}

export async function updateAssignmentStatus(
  assignmentId: string,
  formData: FormData,
): Promise<void> {
  const status = String(formData.get("status") ?? "");
  if (!["active", "completed", "paused"].includes(status)) {
    throw new Error(`bad status ${status}`);
  }
  const { error } = await supabase
    .from("assignments")
    .update({ status })
    .eq("id", assignmentId);
  if (error) throw new Error(`updating assignment: ${error.message}`);
  revalidatePath("/", "layout");
}
