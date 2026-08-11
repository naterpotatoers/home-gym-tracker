import { revalidatePath } from "next/cache";
import { supabase } from "../db/client";

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
 *  still references `value` in `column`. */
export async function assertNoRefs(
  table: string,
  column: string,
  value: string,
  message: string,
): Promise<void> {
  const { count, error } = await supabase
    .from(table)
    .select(column, { count: "exact" })
    .eq(column, value)
    .limit(1);
  if (error) throw new Error(`checking ${table}: ${error.message}`);
  if ((count ?? 0) > 0) throw new Error(message);
}
