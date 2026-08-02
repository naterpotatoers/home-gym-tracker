import { MeterLegend, MuscleMeterGroups } from "@/components/meter-rows";
import type { GroupedCoverage } from "@/lib/coverage";

/**
 * Status-colored bars per muscle, grouped by muscle group — the prescribed-work
 * counterpart of the logged-volume section, in the same visual language.
 * Isomorphic: the routine editor renders it live on the client, program pages
 * on the server.
 */
export function MuscleCoverageBars({ groups }: { groups: GroupedCoverage[] }) {
  return (
    <div>
      <MuscleMeterGroups
        groups={groups.map((group) => ({
          groupId: group.groupId,
          label: group.label,
          rows: group.rows.map((row) => ({
            id: row.muscleId,
            name: row.name,
            peakScore: row.peakScore,
            value: row.weightedSets,
            display: row.weightedSets > 0 ? row.weightedSets.toFixed(1) : "—",
            status: row.status,
          })),
        }))}
      />
      <MeterLegend mode="coverage" />
    </div>
  );
}
