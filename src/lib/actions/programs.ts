"use server";

import { redirect } from "next/navigation";
import { supabase } from "../db/client";
import {
  assignmentToRow,
  programDayToRow,
  programToRow,
} from "../db/mappers";
import { newId, slugId } from "../ids";
import { isIsoDate, MAX_PROGRAM_WEEKS } from "../validate";
import { assertNoRefs, revalidateAll, run } from "./_helpers";
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
  await run(
    "updating program",
    supabase
      .from("programs")
      .update({ name: patch.name.trim(), notes: patch.notes })
      .eq("id", programId),
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

/** Insert a copy of `week` directly after it, shifting later weeks down. */
export async function duplicateWeek(programId: string, week: number): Promise<void> {
  const state = await weekState(programId, week);
  if (state.weeks >= MAX_PROGRAM_WEEKS) throw new Error(`Programs cap at ${MAX_PROGRAM_WEEKS} weeks.`);
  const later = state.all.filter((d) => d.week > week);

  // Rewrite: delete everything after the source week, then reinsert shifted
  // +1 with the duplicate in between. Two steps because the composite PK
  // (program_id, week, day_of_week) forbids in-place shifts.
  await run(
    "duplicating week",
    supabase.from("program_days").delete().eq("program_id", programId).gt("week", week),
  );

  const rows = [
    ...state.ofWeek.map((d) => programDayRow(programId, week + 1, d)),
    ...later.map((d) => programDayRow(programId, d.week + 1, d)),
  ];
  if (rows.length > 0) {
    await run("duplicating week", supabase.from("program_days").insert(rows));
  }

  await run(
    "duplicating week",
    supabase.from("programs").update({ weeks: state.weeks + 1 }).eq("id", programId),
  );
  revalidateAll();
}

/** Delete a week and close the gap; later weeks shift up. */
export async function removeWeek(programId: string, week: number): Promise<void> {
  const state = await weekState(programId);
  if (state.weeks <= 1) throw new Error("A program keeps at least one week.");
  const later = state.all.filter((d) => d.week > week);

  await run(
    "removing week",
    supabase.from("program_days").delete().eq("program_id", programId).gte("week", week),
  );
  if (later.length > 0) {
    await run(
      "removing week",
      supabase
        .from("program_days")
        .insert(later.map((d) => programDayRow(programId, d.week - 1, d))),
    );
  }

  await run(
    "removing week",
    supabase.from("programs").update({ weeks: state.weeks - 1 }).eq("id", programId),
  );
  revalidateAll();
}

export async function setProgramDay(
  programId: string,
  week: number,
  dayOfWeek: number,
  routineId: string,
): Promise<void> {
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

export async function createAssignment(formData: FormData): Promise<void> {
  const programId = String(formData.get("programId") ?? "");
  const clientId = String(formData.get("clientId") ?? "");
  const startDate = String(formData.get("startDate") ?? "");
  await assertClientId(clientId);
  if (!isIsoDate(startDate)) throw new Error("Pick a start date.");
  await run(
    "assigning program",
    supabase.from("assignments").insert(
      assignmentToRow({
        id: newId("a"),
        programId,
        clientId,
        startDate,
        status: "active",
      }),
    ),
  );
  revalidateAll();
}

export async function updateAssignmentStatus(
  assignmentId: string,
  formData: FormData,
): Promise<void> {
  const status = String(formData.get("status") ?? "");
  if (!["active", "completed", "paused"].includes(status)) {
    throw new Error(`bad status ${status}`);
  }
  await run(
    "updating assignment",
    supabase.from("assignments").update({ status }).eq("id", assignmentId),
  );
  revalidateAll();
}
