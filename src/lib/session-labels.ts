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

/** First index at or after `from` that isn't completed, wrapping once. */
export function nextIncomplete(sets: readonly SetLog[], from: number): number {
  for (let i = from; i < sets.length; i++) if (!sets[i].completed) return i;
  for (let i = 0; i < from; i++) if (!sets[i].completed) return i;
  return -1;
}
