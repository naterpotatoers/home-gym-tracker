import { MUSCLE_GROUP_COLORS, muscleGroups } from "@/lib/data/muscles";

/** Compact dot-per-muscle-group key — for any view that colors things by
 *  primary muscle group (routine builder cards, the Clients lift table). */
export function MuscleGroupLegend() {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
      {[...muscleGroups]
        .sort((a, b) => a.order - b.order)
        .map((group) => (
          <span key={group.id} className="inline-flex items-center gap-1.5">
            <span
              className="size-2.5 rounded-full"
              style={{ backgroundColor: MUSCLE_GROUP_COLORS[group.id] }}
            />
            {group.label.toLowerCase()}
          </span>
        ))}
    </div>
  );
}
