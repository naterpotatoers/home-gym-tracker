"use server";

import { revalidatePath } from "next/cache";
import { clients, weighIns } from "../data/clients";
import {
  assignments,
  programDays,
  programs,
  routineExercises,
  routines,
} from "../data/programs";
import { sessions, setLogs } from "../data/sessions";
import { supabase } from "../db/client";
import {
  assignmentToRow,
  clientToRow,
  programDayToRow,
  programToRow,
  routineExerciseToRow,
  routineToRow,
  sessionToRow,
  setLogToRow,
  weighInToRow,
} from "../db/mappers";
import { tableStatuses } from "../db/status";

const CHUNK = 500;

async function insertAll(table: string, rows: readonly Record<string, unknown>[]) {
  for (let i = 0; i < rows.length; i += CHUNK) {
    const { error } = await supabase.from(table).insert(rows.slice(i, i + CHUNK));
    if (error) throw new Error(`seeding ${table}: ${error.message}`);
  }
}

/**
 * One-time load of the TypeScript seed tables into Supabase, in foreign-key
 * order. Refuses to run against any non-empty table, so it is safe to leave
 * reachable — it can only ever bootstrap, never clobber.
 */
export async function seedDatabase(): Promise<void> {
  const statuses = await tableStatuses();
  const missing = statuses.filter((s) => s.count === null);
  if (missing.length > 0) {
    throw new Error(
      `Tables missing (${missing.map((s) => s.table).join(", ")}) — run supabase/migrations/001_init.sql in the Supabase SQL editor first.`,
    );
  }
  // Migration 002 seeds the clients table itself, so rows there are expected
  // and must not block a fresh bootstrap of everything else.
  const nonEmpty = statuses.filter((s) => s.table !== "clients" && (s.count ?? 0) > 0);
  if (nonEmpty.length > 0) {
    throw new Error(
      `Refusing to seed: ${nonEmpty.map((s) => `${s.table} has ${s.count} rows`).join(", ")}.`,
    );
  }

  const clientsEmpty = statuses.find((s) => s.table === "clients")?.count === 0;
  if (clientsEmpty) await insertAll("clients", clients.map(clientToRow));
  await insertAll("routines", routines.map(routineToRow));
  await insertAll("routine_exercises", routineExercises.map(routineExerciseToRow));
  await insertAll("programs", programs.map(programToRow));
  await insertAll("program_days", programDays.map(programDayToRow));
  await insertAll("assignments", assignments.map(assignmentToRow));
  await insertAll("sessions", sessions.map(sessionToRow));
  await insertAll("set_logs", setLogs.map(setLogToRow));
  await insertAll("weigh_ins", weighIns.map(weighInToRow));

  revalidatePath("/", "layout");
}
