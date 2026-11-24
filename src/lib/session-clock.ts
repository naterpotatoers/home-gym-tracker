/**
 * Where a live session's clock started — pure helpers for use-session-clock,
 * which keeps the start in localStorage as `workout-start-<key>` (the
 * session id when solo, the board's comma-joined session ids on a board).
 */

import { SNAPSHOT_MAX_AGE_MS, SNAPSHOT_PREFIX, snapshotAge } from "./pending-saves";

export const CLOCK_PREFIX = "workout-start-";

/** A clock start older than this is a leftover from an abandoned day, not a
 *  workout still in progress — restart rather than showing "437 min". */
export const CLOCK_STALE_MS = 12 * 60 * 60 * 1000;

export function isFreshStart(start: number, now: number): boolean {
  return Number.isFinite(start) && start > 0 && now - start < CLOCK_STALE_MS;
}

/**
 * A solo runner opened for someone already on a group board (after a
 * reload, say) inherits the board's start, so their duration isn't reset to
 * 0. Picks the earliest fresh board start whose id list holds this session.
 */
export function inheritedStart(
  entries: Iterable<readonly [key: string, value: string | null]>,
  sessionId: string,
  now: number,
): number | null {
  let best: number | null = null;
  for (const [key, value] of entries) {
    if (!key.startsWith(CLOCK_PREFIX)) continue;
    const ids = key.slice(CLOCK_PREFIX.length).split(",");
    if (ids.length < 2 || !ids.includes(sessionId)) continue;
    const start = Number(value);
    if (isFreshStart(start, now) && (best === null || start < best)) best = start;
  }
  return best;
}

/**
 * Live-session localStorage keys that are leftovers, not work in progress:
 * clock starts past CLOCK_STALE_MS and set-list snapshots past their max age
 * (e.g. a session discarded from the launcher, which never mounted its
 * runner to clear them), plus unreadable values under either prefix. Other
 * keys are never touched.
 */
export function staleKeys(
  entries: Iterable<readonly [key: string, value: string | null]>,
  now: number,
): string[] {
  const out: string[] = [];
  for (const [key, value] of entries) {
    if (key.startsWith(CLOCK_PREFIX)) {
      if (!isFreshStart(Number(value), now)) out.push(key);
    } else if (key.startsWith(SNAPSHOT_PREFIX)) {
      const at = snapshotAge(value);
      if (at === null || now - at > SNAPSHOT_MAX_AGE_MS) out.push(key);
    }
  }
  return out;
}
