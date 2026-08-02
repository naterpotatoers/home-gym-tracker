"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { supabase } from "../db/client";
import { newId, slugId } from "../ids";
import { isClientId } from "../validate";

export async function createProgram(formData: FormData): Promise<void> {
  const name = String(formData.get("name") ?? "").trim();
  const weeks = Number(formData.get("weeks") ?? 0);
  if (!name) throw new Error("Program needs a name.");
  if (!Number.isInteger(weeks) || weeks < 1 || weeks > 52) {
    throw new Error("Weeks must be between 1 and 52.");
  }
  const id = slugId("p", name);
  const { error } = await supabase
    .from("programs")
    .insert({ id, name, weeks, notes: "" });
  if (error) throw new Error(`creating program: ${error.message}`);
  revalidatePath("/", "layout");
  redirect(`/programs/${id}`);
}

export async function updateProgramMeta(
  programId: string,
  patch: { name: string; weeks: number; notes: string },
): Promise<void> {
  if (!patch.name.trim()) throw new Error("Program needs a name.");
  if (!Number.isInteger(patch.weeks) || patch.weeks < 1 || patch.weeks > 52) {
    throw new Error("Weeks must be between 1 and 52.");
  }
  const { error } = await supabase
    .from("programs")
    .update({ name: patch.name.trim(), weeks: patch.weeks, notes: patch.notes })
    .eq("id", programId);
  if (error) throw new Error(`updating program: ${error.message}`);

  // Shrinking the program orphans days beyond the new length — prune them.
  const { error: pruneError } = await supabase
    .from("program_days")
    .delete()
    .eq("program_id", programId)
    .gt("week", patch.weeks);
  if (pruneError) throw new Error(`updating program: ${pruneError.message}`);

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

/** Stamp one week's layout across every week of the program. */
export async function copyWeekToAll(
  programId: string,
  sourceWeek: number,
): Promise<void> {
  const [{ data: program, error: programError }, { data: days, error: daysError }] =
    await Promise.all([
      supabase.from("programs").select("weeks").eq("id", programId).single(),
      supabase
        .from("program_days")
        .select("*")
        .eq("program_id", programId)
        .eq("week", sourceWeek),
    ]);
  if (programError) throw new Error(`copying week: ${programError.message}`);
  if (daysError) throw new Error(`copying week: ${daysError.message}`);

  const { error: deleteError } = await supabase
    .from("program_days")
    .delete()
    .eq("program_id", programId)
    .neq("week", sourceWeek);
  if (deleteError) throw new Error(`copying week: ${deleteError.message}`);

  const rows = [];
  for (let week = 1; week <= program.weeks; week++) {
    if (week === sourceWeek) continue;
    for (const day of days ?? []) {
      rows.push({
        program_id: programId,
        week,
        day_of_week: day.day_of_week,
        routine_id: day.routine_id,
      });
    }
  }
  if (rows.length > 0) {
    const { error } = await supabase.from("program_days").insert(rows);
    if (error) throw new Error(`copying week: ${error.message}`);
  }
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
  if (!isClientId(clientId)) throw new Error(`bad client id ${clientId}`);
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
