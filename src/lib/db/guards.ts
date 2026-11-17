import "server-only";
import { clients as seedClients } from "../data/clients";
import { exercises as seedExercises } from "../data/exercises";
import { supabase } from "./client";

/**
 * Write-time existence checks for the open-string ids (clients and exercises
 * are DB rows, not compile-time unions). Deliberately NOT in a "use server"
 * file: every export there becomes a public endpoint, and these are internal
 * guards the actions call, not actions.
 */

/** PostgREST's "relation does not exist" — a table whose migration hasn't run
 *  yet. The one spelling of the check behind every seed/missing fallback. */
export function isMissingTable(error: { code?: string } | null | undefined): boolean {
  return error?.code === "PGRST205";
}

/** Verify a client id exists before writing. Falls back to the TS seed
 *  roster while the clients table doesn't exist, mirroring the read side. */
export async function assertClientId(id: string): Promise<void> {
  const { data, error } = await supabase
    .from("clients")
    .select("id")
    .eq("id", id)
    .maybeSingle();
  if (isMissingTable(error)) {
    if (!seedClients.some((c) => c.id === id)) throw new Error(`bad client id ${id}`);
    return;
  }
  if (error) throw new Error(`checking client: ${error.message}`);
  if (!data) throw new Error(`bad client id ${id}`);
}

/** Verify exercise ids exist before writing — one query for N ids. Same seed
 *  fallback while the exercise tables don't exist yet. */
export async function assertExerciseIds(ids: Iterable<string>): Promise<void> {
  const unique = [...new Set(ids)];
  if (unique.length === 0) return;
  const { data, error } = await supabase.from("exercises").select("id").in("id", unique);
  let found: Set<string>;
  if (isMissingTable(error)) {
    found = new Set(seedExercises.map((e) => e.id));
  } else if (error) {
    throw new Error(`checking exercises: ${error.message}`);
  } else {
    found = new Set((data ?? []).map((row) => row.id as string));
  }
  for (const id of unique) {
    if (!found.has(id)) throw new Error(`bad exercise id ${id}`);
  }
}
