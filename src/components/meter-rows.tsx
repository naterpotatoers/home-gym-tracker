import type { CoverageStatus } from "@/lib/coverage";
import type { MeterGroup } from "@/lib/meters";

/**
 * Shared status-colored muscle meters — the routine/program coverage bars
 * (client + server). Status color is never the only encoding: the text label
 * and legend always accompany it (red/green colorblind safety). Ordinal
 * (band) work never renders as length in a pounds bar — the body heat map
 * owns that hatched treatment.
 */

const FILL: Record<CoverageStatus, string> = {
  solid: "bg-success",
  light: "bg-warning",
  neglected: "bg-danger",
};

function MeterBar({
  value,
  max,
  status,
}: {
  value: number;
  max: number;
  status: CoverageStatus;
}) {
  const pct = Math.max(value > 0 ? 2 : 0, (value / Math.max(max, 1)) * 100);
  return (
    <div className="flex h-2.5 w-full items-stretch gap-0.5 rounded-full bg-track">
      {pct > 0 && (
        <div
          className={`h-2.5 rounded-full ${FILL[status]}`}
          style={{ width: `${pct}%` }}
        />
      )}
    </div>
  );
}

export function StatusLabel({ status }: { status: CoverageStatus }) {
  if (status === "neglected") {
    return <span className="text-xs font-semibold text-danger-text">neglected</span>;
  }
  if (status === "light") {
    return <span className="text-xs text-warning-text">light</span>;
  }
  return null;
}

export function MeterLegend() {
  const items = [
    { className: "bg-success", label: "solid — 6+ hard sets" },
    { className: "bg-warning", label: "light — under 6" },
    { className: "bg-danger", label: "neglected — under 2, or nothing direct" },
  ];
  return (
    <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
      {items.map((item) => (
        <span key={item.label} className="flex items-center gap-1.5">
          <span className={`h-2.5 w-4 rounded-full ${item.className}`} />
          {item.label}
        </span>
      ))}
    </div>
  );
}

/** The row renderer both bar sections share, laid out by its own width (an
 *  @container — it also sits in the narrow Coverage side sheet): narrow,
 *  name/value/status on one line with a full-width bar below; from 36rem,
 *  the single-line grid (≈30rem of fixed columns plus the bar). */
export function MuscleMeterGroups({ groups }: { groups: MeterGroup[] }) {
  const max = Math.max(1, ...groups.flatMap((g) => g.rows.map((r) => r.value)));
  return (
    <div className="@container space-y-5">
      {groups.map((group) => (
        <div key={group.groupId}>
          <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted">
            {group.label}
          </h3>
          <div className="space-y-2 @min-[36rem]:space-y-1">
            {group.rows.map((row) => (
              <div
                key={row.id}
                className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-x-3 gap-y-1 text-sm @min-[36rem]:grid-cols-[10rem_3.5rem_minmax(0,1fr)_8rem_6rem]"
              >
                <span className="order-1 truncate">{row.name}</span>
                <span className="order-5 hidden text-right font-mono text-xs text-muted @min-[36rem]:order-2 @min-[36rem]:block">
                  {row.peakScore}/10
                </span>
                <div className="order-4 col-span-3 @min-[36rem]:order-3 @min-[36rem]:col-span-1">
                  <MeterBar value={row.value} max={max} status={row.status} />
                </div>
                <span className="order-2 text-right font-mono text-xs @min-[36rem]:order-4">
                  {row.display}
                </span>
                <span className="order-3 text-right @min-[36rem]:order-5 @min-[36rem]:pl-2 @min-[36rem]:text-left">
                  <StatusLabel status={row.status} />
                </span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
