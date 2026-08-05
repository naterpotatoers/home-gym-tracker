import { bandLabel } from "./queries";
import type { RoutineExercise, SetLog } from "./types";

/** Pure label + cursor helpers for the live session cards — extracted so the
 *  self-healing cursor logic is unit-testable outside the client component. */

/** Short prefilled-target label for the one-tap hero row. */
export function describeTarget(set: SetLog): string {
  if (set.durationSeconds !== null) return `${set.durationSeconds}s`;
  const reps = set.reps !== null ? ` × ${set.reps}` : "";
  switch (set.modalityId) {
    case "barbell":
    case "machine":
      return `${set.weightLbs ?? "—"} lb${reps}`;
    case "dumbbell":
      return set.distanceFeet !== null
        ? `${set.weightLbs ?? "—"} lb × ${set.distanceFeet} ft`
        : `${set.weightLbs ?? "—"} lb ea${reps}`;
    case "bodyweight":
      return `BW${set.addedWeightLbs ? `+${set.addedWeightLbs}` : ""}${reps}`;
    case "band":
      return `${bandLabel(set) || "band"} band${reps}`;
  }
}

/** "3×10 @ RIR 2 · rest 90s" — collapses equal rep ranges to one number. */
export function rxLabel(rx: RoutineExercise): string {
  const scheme =
    rx.durationSeconds !== null
      ? `${rx.sets}×${rx.durationSeconds}s`
      : rx.repMin === rx.repMax
        ? `${rx.sets}×${rx.repMax ?? "?"}`
        : `${rx.sets}×${rx.repMin ?? "?"}–${rx.repMax ?? "?"}`;
  return `${scheme}${rx.targetRir !== null ? ` @ RIR ${rx.targetRir}` : ""} · rest ${rx.restSeconds}s`;
}

/** First index at or after `from` that isn't completed. Forward-only: never
 *  wraps back to earlier (deliberately skipped) sets. */
export function nextIncomplete(sets: readonly SetLog[], from: number): number {
  for (let i = Math.max(from, 0); i < sets.length; i++) {
    if (!sets[i].completed) return i;
  }
  return -1;
}

/** Resolve an id-based cursor to the set the LOG hero should show.
 *  - the set itself, while it exists and is incomplete
 *  - if it completed, the first incomplete set AFTER it (never behind), so a
 *    cursor parked on the session's last logged set self-recovers when new
 *    sets are appended
 *  - null, or an id that no longer exists (removed without re-aiming) →
 *    parked: nothing to log
 *  Never scans backward — skipped sets stay skipped. */
export function resolveCursor(sets: readonly SetLog[], cursorId: string | null): SetLog | null {
  if (cursorId === null) return null;
  const at = sets.findIndex((s) => s.id === cursorId);
  if (at === -1) return null;
  const next = nextIncomplete(sets, sets[at].completed ? at + 1 : at);
  return next === -1 ? null : sets[next];
}

/** Id of the first incomplete set strictly after `fromId` — where the cursor
 *  lands after LOG. The caller marks `fromId` complete separately, so this
 *  looks only at what's ahead of it. Null = nothing ahead. */
export function advanceCursor(sets: readonly SetLog[], fromId: string): string | null {
  const at = sets.findIndex((s) => s.id === fromId);
  if (at === -1) return null;
  const next = nextIncomplete(sets, at + 1);
  return next === -1 ? null : sets[next].id;
}
