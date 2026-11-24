import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  clientToRow,
  routineExerciseToRow,
  routineToRow,
  sessionToRow,
  setLogToRow,
  type SetLogRow,
} from "../../src/lib/db/mappers";
import { timeoutFetch } from "../../src/lib/db/timeout-fetch";
import type { Client, Routine, RoutineExercise, Session, SetLog } from "../../src/lib/types";

/**
 * Direct DB access for e2e setup, teardown and persistence checks — the same
 * live Supabase the app uses (tests only ever touch rows whose ids start
 * with `e2e_` / `r_e2e_`, see world.ts). Rows go through the app's own
 * mappers so a schema change breaks here at compile time, not at runtime.
 */
let client: SupabaseClient | null = null;

export function db(): SupabaseClient {
  if (client) return client;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) {
    throw new Error("e2e needs SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY (.env.local or CI secrets)");
  }
  client = createClient(url, key, { auth: { persistSession: false }, global: { fetch: timeoutFetch() } });
  return client;
}

function check<T>(result: { data: T; error: { message: string } | null }, what: string): T {
  if (result.error) throw new Error(`${what}: ${result.error.message}`);
  return result.data;
}

export async function insertClients(rows: Client[]) {
  check(await db().from("clients").insert(rows.map(clientToRow)), "insert clients");
}

export async function insertRoutine(routine: Routine, exercises: RoutineExercise[]) {
  check(await db().from("routines").insert(routineToRow(routine)), "insert routine");
  check(
    await db().from("routine_exercises").insert(exercises.map(routineExerciseToRow)),
    "insert routine exercises",
  );
}

export async function insertHistory(sessions: Session[], sets: SetLog[]) {
  if (sessions.length === 0) return;
  check(await db().from("sessions").insert(sessions.map(sessionToRow)), "insert sessions");
  check(await db().from("set_logs").insert(sets.map(setLogToRow)), "insert set logs");
}

/** Delete everything a world created. Order matters: sessions (set_logs
 *  cascade) → routine (routine_exercises cascade) → clients. */
export async function deleteWorld(clientIds: string[], routineIds: string[]) {
  if (clientIds.length > 0) {
    check(await db().from("sessions").delete().in("client_id", clientIds), "delete sessions");
  }
  if (routineIds.length > 0) {
    check(await db().from("routines").delete().in("id", routineIds), "delete routines");
  }
  if (clientIds.length > 0) {
    check(await db().from("clients").delete().in("id", clientIds), "delete clients");
  }
}

/** Every e2e client id currently in the DB (for the leftover sweep). */
export async function e2eClientIds(): Promise<string[]> {
  const rows = check(await db().from("clients").select("id").like("id", "e2e\\_%"), "list e2e clients");
  return (rows as { id: string }[]).map((r) => r.id);
}

export async function e2eRoutineIds(): Promise<string[]> {
  const rows = check(await db().from("routines").select("id").like("id", "r\\_e2e\\_%"), "list e2e routines");
  return (rows as { id: string }[]).map((r) => r.id);
}

// ---- Persistence checks (read-only) ----

export type SessionRow = { id: string; status: string; rpe: number | null; routine_id: string | null };

export async function sessionsOf(clientId: string): Promise<SessionRow[]> {
  return check(
    await db()
      .from("sessions")
      .select("id,status,rpe,routine_id")
      .eq("client_id", clientId)
      .order("date", { ascending: false }),
    "read sessions",
  ) as SessionRow[];
}

/** The person's one in-progress session, or null. */
export async function plannedSessionId(clientId: string): Promise<string | null> {
  return (await sessionsOf(clientId)).find((s) => s.status === "planned")?.id ?? null;
}

export async function setsOf(sessionId: string): Promise<SetLogRow[]> {
  return check(
    await db().from("set_logs").select("*").eq("session_id", sessionId).order("position"),
    "read set logs",
  ) as SetLogRow[];
}

export async function exerciseNames(ids: string[]): Promise<Record<string, string>> {
  const rows = check(await db().from("exercises").select("id,name").in("id", ids), "read exercises");
  const names = Object.fromEntries((rows as { id: string; name: string }[]).map((r) => [r.id, r.name]));
  const missing = ids.filter((id) => !names[id]);
  if (missing.length > 0) throw new Error(`e2e catalog ids missing from the live DB: ${missing.join(", ")}`);
  return names;
}

export async function assertVariants(pairs: readonly (readonly [string, string])[]) {
  const ids = [...new Set(pairs.map(([e]) => e))];
  const rows = check(
    await db().from("exercise_modalities").select("exercise_id,modality_id").in("exercise_id", ids),
    "read variants",
  ) as { exercise_id: string; modality_id: string }[];
  const have = new Set(rows.map((r) => `${r.exercise_id}/${r.modality_id}`));
  const missing = pairs.map(([e, m]) => `${e}/${m}`).filter((k) => !have.has(k));
  if (missing.length > 0) throw new Error(`e2e variants missing from the live DB: ${missing.join(", ")}`);
}
