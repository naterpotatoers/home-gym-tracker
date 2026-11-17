import { recapSetClass } from "@/components/ui";
import type { GymData } from "@/lib/gym-data";
import { describeSet } from "@/lib/queries";
import type { SetLog } from "@/lib/types";

/** A block's sets as recap lines — "1. 135 lb × 8 · RIR 2", skipped sets
 *  struck through. Shared by the session recap and Recent workouts. */
export function SetRecap({ data, sets }: { data: GymData; sets: readonly SetLog[] }) {
  return (
    <ul className="space-y-0.5">
      {sets.map((set) => (
        <li key={set.id} className="flex gap-2 font-mono text-xs">
          <span className="w-4 shrink-0 text-right text-muted">{set.setNumber}.</span>
          <span className={recapSetClass(set.completed)}>
            {describeSet(data, set)}
            {!set.completed && " · skipped"}
          </span>
        </li>
      ))}
    </ul>
  );
}
