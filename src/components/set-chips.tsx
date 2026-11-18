import { SKIPPED_SET_CLASS } from "@/components/ui";
import { compactSet } from "@/lib/session-labels";
import type { SetLog } from "@/lib/types";

/**
 * One exercise's sets as mono chips — "155×10", "BW×8", "blue×12", bike
 * pieces as time + watts — so weight and reps read at a glance. Skipped sets
 * are muted and struck through; warm-ups carry a "W". Shared by Recent
 * workouts and a lift's Sessions list.
 */
export function SetChips({ sets }: { sets: readonly SetLog[] }) {
  return (
    <span className="flex flex-wrap gap-1">
      {sets.map((set) => (
        <span
          key={set.id}
          className={`rounded-md border border-border bg-surface px-2 py-0.5 font-mono text-sm ${
            set.completed ? "" : SKIPPED_SET_CLASS
          }`}
          title={set.completed ? undefined : "skipped"}
        >
          {set.isWarmup && <span className="mr-1 text-xs text-muted">W</span>}
          {compactSet(set)}
        </span>
      ))}
    </span>
  );
}
