import "server-only";
import { connection } from "next/server";
import { cache } from "react";
import { seedSnapshot } from "../data/seed-snapshot";
import { buildGymData, type GymData } from "../gym-data";
import { supabase } from "./client";
import {
  rowToAssignment,
  rowToProgram,
  rowToProgramDay,
  rowToRoutine,
  rowToRoutineExercise,
  rowToSession,
  rowToSetLog,
  rowToWeighIn,
} from "./mappers";

/** PostgREST's code for "table does not exist" — the migration hasn't run. */
class TablesMissingError extends Error {}

async function fetchAll(table: string, orderBy: readonly string[]) {
  let query = supabase.from(table).select("*");
  for (const column of orderBy) query = query.order(column);
  const { data, error } = await query;
  if (error?.code === "PGRST205") {
    throw new TablesMissingError(`table ${table} missing`);
  }
  if (error) throw new Error(`loading ${table}: ${error.message}`);
  return data;
}

/**
 * One round of parallel fetches per request. `cache()` memoizes within a
 * request only, so a page and every nested server component share a single
 * consistent snapshot and nothing survives across requests. The dataset is
 * hundreds of rows; fetching it whole is what keeps the entire query layer
 * synchronous.
 */
export const loadGymData = cache(async (): Promise<GymData> => {
  // Request-time only: the data mutates, so no page reading it may prerender.
  // (supabase-js would otherwise swallow Next's dynamic-usage sentinel error
  // during build-time prerendering and fail the build.)
  await connection();
  try {
    const [
      routines,
      routineExercises,
      programs,
      programDays,
      assignments,
      sessions,
      setLogs,
      weighIns,
    ] = await Promise.all([
      fetchAll("routines", ["id"]),
      fetchAll("routine_exercises", ["routine_id", "sort_order"]),
      fetchAll("programs", ["id"]),
      fetchAll("program_days", ["program_id", "week", "day_of_week"]),
      fetchAll("assignments", ["id"]),
      fetchAll("sessions", ["date"]),
      fetchAll("set_logs", ["session_id", "position"]),
      fetchAll("weigh_ins", ["client_id", "date"]),
    ]);

    return buildGymData({
      source: "database",
      routines: routines.map(rowToRoutine),
      routineExercises: routineExercises.map(rowToRoutineExercise),
      programs: programs.map(rowToProgram),
      programDays: programDays.map(rowToProgramDay),
      assignments: assignments.map(rowToAssignment),
      sessions: sessions.map(rowToSession),
      setLogs: setLogs.map(rowToSetLog),
      weighIns: weighIns.map(rowToWeighIn),
    });
  } catch (error) {
    // Bootstrap fallback ONLY for "the migration hasn't run yet": the app
    // works read-only off the TypeScript seed and the UI shows a setup banner
    // (GymData.source === "seed"). Any other database error still throws —
    // falling back would silently mask real outages.
    if (error instanceof TablesMissingError) return seedSnapshot();
    throw error;
  }
});
