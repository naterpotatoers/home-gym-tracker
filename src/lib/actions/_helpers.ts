import { revalidatePath } from "next/cache";
import { supabase } from "../db/client";
import { sessionToRow, setLogToRow } from "../db/mappers";
import type { Session, SetLog } from "../types";

/**
 * Shared plumbing for the server-action files. Deliberately NOT a
 * "use server" file — these are ordinary server helpers (some synchronous),
 * not RPC endpoints; only the action files import them.
 */

/** Every mutation ends with this: reads are a per-request snapshot, so the
 *  whole layout revalidates. */
export function revalidateAll(): void {
  revalidatePath("/", "layout");
}

/** Await a Supabase query; throw `label: message` on error, return the data.
 *  Query builders are thenable, so call sites pass them unawaited. */
export async function run<T>(
  label: string,
  query: PromiseLike<{ data: T; error: { message: string } | null }>,
): Promise<T> {
  const { data, error } = await query;
  if (error) throw new Error(`${label}: ${error.message}`);
  return data;
}

/**
 * Like run(), but translates a unique violation (Postgres 23505 — here always
 * a lower(name) index) into `duplicateMessage`. For writes where "already
 * exists" is a user answer, not a crash.
 */
export async function runOrDuplicate<T>(
  label: string,
  query: PromiseLike<{ data: T; error: { code?: string; message: string } | null }>,
  duplicateMessage: string,
): Promise<T> {
  const { data, error } = await query;
  if (error) {
    if (error.code === "23505") throw new Error(duplicateMessage);
    throw new Error(`${label}: ${error.message}`);
  }
  return data;
}

/** Referential-integrity guard for deletes: refuse while any row in `table`
 *  still references `value` in `column`. `optionalTable` treats a missing
 *  table (migration not run) as "no references". */
export async function assertNoRefs(
  table: string,
  column: string,
  value: string,
  message: string,
  { optionalTable = false }: { optionalTable?: boolean } = {},
): Promise<void> {
  const { count, error } = await supabase
    .from(table)
    .select(column, { count: "exact" })
    .eq(column, value)
    .limit(1);
  // A table with its own snapshot fallback (nutrition) may not exist yet —
  // then nothing can reference the value.
  if (optionalTable && error?.code === "PGRST205") return;
  if (error) throw new Error(`checking ${table}: ${error.message}`);
  if ((count ?? 0) > 0) throw new Error(message);
}

/** run() for an update/upsert-by-id that must hit a row: pass the builder
 *  with `.select("id")` so the matched rows come back, and a stale or forged
 *  id throws instead of silently changing nothing. */
export async function runMatched(
  label: string,
  query: PromiseLike<{ data: unknown[] | null; error: { message: string } | null }>,
): Promise<void> {
  const rows = await run(label, query);
  if (!rows || rows.length === 0) throw new Error(`${label}: not found`);
}

/** Sessions plus their sets, all or nothing: Supabase has no client-side
 *  transactions, so a failed set insert removes the session rows it would
 *  have orphaned (an empty planned session would otherwise capture every
 *  later Play tap via the resume check in startSession). Shared by the solo and group starts. */
export async function insertSessions(
  label: string,
  sessions: readonly Session[],
  sets: readonly SetLog[],
): Promise<void> {
  await run(label, supabase.from("sessions").insert(sessions.map(sessionToRow)));
  try {
    await run(label, supabase.from("set_logs").insert(sets.map(setLogToRow)));
  } catch (error) {
    await supabase
      .from("sessions")
      .delete()
      .in("id", sessions.map((s) => s.id));
    throw error;
  }
}
