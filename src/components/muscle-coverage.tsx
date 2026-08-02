import type { GroupedCoverage } from "@/lib/coverage";

/**
 * Bars per muscle, grouped by muscle group — the prescribed-work counterpart
 * of the logged-volume section, in the same visual language. Isomorphic: the
 * routine editor renders it live on the client, program pages on the server.
 */
export function MuscleCoverageBars({ groups }: { groups: GroupedCoverage[] }) {
  const max = Math.max(
    1,
    ...groups.flatMap((g) => g.rows.map((r) => r.weightedSets)),
  );
  return (
    <div className="space-y-5">
      {groups.map((group) => (
        <div key={group.groupId}>
          <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide opacity-60">
            {group.label}
          </h3>
          <table className="w-full text-sm">
            <tbody>
              {group.rows.map((row) => (
                <tr key={row.muscleId}>
                  <td className="w-40 py-0.5">{row.name}</td>
                  <td className="w-14 py-0.5 text-right font-mono text-xs opacity-60">
                    {row.peakScore}/10
                  </td>
                  <td className="py-0.5 pl-3">
                    <div className="h-2 w-full rounded bg-current/10">
                      <div
                        className="h-2 rounded bg-current/50"
                        style={{
                          width: `${Math.max(
                            row.weightedSets > 0 ? 2 : 0,
                            (row.weightedSets / max) * 100,
                          )}%`,
                        }}
                      />
                    </div>
                  </td>
                  <td className="w-24 py-0.5 text-right font-mono text-xs">
                    {row.weightedSets > 0 ? row.weightedSets.toFixed(1) : "—"}
                  </td>
                  <td className="w-24 py-0.5 pl-2 text-xs">
                    {row.status === "neglected" ? (
                      <span className="font-semibold opacity-80">neglected</span>
                    ) : row.status === "light" ? (
                      <span className="opacity-50">light</span>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}
