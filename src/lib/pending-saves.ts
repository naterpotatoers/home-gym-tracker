import type { SetLog } from "./types";
import { normalizeSetLog } from "./validate";

/**
 * A per-session snapshot of the set list as this device last had it — the
 * live runner's safety net. Server actions are dispatched one at a time and
 * die with the page, so a reload (or Safari evicting the tab) can drop saves
 * still queued client-side — field edits AND structural ones (add, swap,
 * remove) — and a reload can also render from the database just BEFORE an
 * in-flight save lands. So every local change rewrites the snapshot, and on
 * load a snapshot that differs from the server's list is adopted and synced
 * (sync_set_logs replaces the whole list atomically). Kept until the session
 * is finished or discarded. One device runs a session, so the device's own
 * latest list is the truth. Pure helpers; the hook owns storage.
 */
export type SetListSnapshot = { at: number; sets: SetLog[] };

export const SNAPSHOT_PREFIX = "workout-pending-";

/** Older snapshots are leftovers from an abandoned day, not unsaved work. */
export const SNAPSHOT_MAX_AGE_MS = 3 * 24 * 60 * 60 * 1000;

export function snapshotKey(sessionId: string): string {
  return `${SNAPSHOT_PREFIX}${sessionId}`;
}

export function serializeSnapshot(sets: readonly SetLog[], now: number): string {
  return JSON.stringify({ at: now, sets } satisfies { at: number; sets: readonly SetLog[] });
}

/** Tolerant parse: anything malformed, stale, or for another session reads
 *  as no snapshot. */
export function parseSnapshot(raw: string | null, sessionId: string, now: number): SetLog[] | null {
  if (!raw) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object") return null;
  const { at, sets } = parsed as { at?: unknown; sets?: unknown };
  if (typeof at !== "number" || now - at > SNAPSHOT_MAX_AGE_MS) return null;
  if (!Array.isArray(sets)) return null;
  const ok = sets.every((row: unknown) => {
    if (!row || typeof row !== "object") return false;
    const r = row as Partial<SetLog>;
    return typeof r.id === "string" && r.sessionId === sessionId && typeof r.exerciseId === "string";
  });
  return ok ? (sets as SetLog[]) : null;
}

/** Snapshot time, for pruning — null when unreadable. */
export function snapshotAge(raw: string | null): number | null {
  try {
    const at = (JSON.parse(raw ?? "") as { at?: unknown }).at;
    return typeof at === "number" ? at : null;
  } catch {
    return null;
  }
}

/** Same rows in the same order, as the database would store them: compared
 *  after the server's own normalization (normalizeSetLog), with key order
 *  ignored and null ≡ absent (the mapper omits a null effort, say) — so a
 *  harmless representation difference never re-syncs on every reload. */
export function sameList(a: readonly SetLog[], b: readonly SetLog[]): boolean {
  return a.length === b.length && a.every((row, i) => canonical(row) === canonical(b[i]));
}

function canonical(row: SetLog): string {
  return stable(normalizeSetLog(row));
}

function stable(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "undefined";
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined && v !== null)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${stable(v)}`).join(",")}}`;
}


/**
 * A save error that retrying can't fix — the database needs a migration run
 * first (those messages name the file: "run supabase/migrations/…"). Shown
 * and kept, never cleared by a later successful sync.
 */
export function isMigrationError(message: string): boolean {
  return message.includes("supabase/migrations/");
}
