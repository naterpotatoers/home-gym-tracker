import type { CoverageStatus } from "@/lib/coverage";

/**
 * Shared status-colored muscle meters — used by the routine/program coverage
 * bars (client + server) and the library volume section. Status color is
 * never the only encoding: the text label and legend always accompany it
 * (red/green colorblind safety), and ordinal (band) work renders as a hatched
 * indicator, never as length in a pounds bar.
 */

export type MeterRow = {
  id: string;
  name: string;
  peakScore: number;
  /** Drives bar length, relative to the group set's max. */
  value: number;
  /** Right-hand value text — "4.5" hard sets or "12,340 lb". */
  display: string;
  status: CoverageStatus;
  /** Extra annotation for ordinal work, e.g. "+120 ord". */
  ordinalNote?: string;
};

export type MeterGroup = { groupId: string; label: string; rows: MeterRow[] };

const FILL: Record<CoverageStatus, string> = {
  solid: "bg-success",
  light: "bg-warning",
  neglected: "bg-danger",
};

const HATCH = {
  backgroundImage:
    "repeating-linear-gradient(45deg, var(--muted) 0 3px, transparent 3px 6px)",
} as const;

export function MeterBar({
  value,
  max,
  status,
  ordinal = false,
}: {
  value: number;
  max: number;
  status: CoverageStatus;
  /** Appends a fixed-width hatched stub — band work happened here. */
  ordinal?: boolean;
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
      {ordinal && (
        <div className="h-2.5 w-4 shrink-0 rounded-full opacity-70" style={HATCH} />
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

export function MeterLegend({ mode }: { mode: "coverage" | "volume" }) {
  const items: { className?: string; style?: React.CSSProperties; label: string }[] =
    mode === "coverage"
      ? [
          { className: "bg-success", label: "solid — 6+ hard sets" },
          { className: "bg-warning", label: "light — under 6" },
          { className: "bg-danger", label: "neglected — under 2, or nothing direct" },
        ]
      : [
          { className: "bg-success", label: "solid" },
          { className: "bg-warning", label: "light — under 25% of max, or band-only" },
          { className: "bg-danger", label: "neglected — untrained" },
          { style: HATCH, label: "band work — reps, no lbs" },
        ];
  return (
    <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
      {items.map((item) => (
        <span key={item.label} className="flex items-center gap-1.5">
          <span
            className={`h-2.5 w-4 rounded-full ${item.className ?? "opacity-70"}`}
            style={item.style}
          />
          {item.label}
        </span>
      ))}
    </div>
  );
}

/** The row renderer both bar sections share. Phone: name/value/status on one
 *  line, full-width bar below. sm+: the classic single-line grid. */
export function MuscleMeterGroups({ groups }: { groups: MeterGroup[] }) {
  const max = Math.max(1, ...groups.flatMap((g) => g.rows.map((r) => r.value)));
  return (
    <div className="space-y-5">
      {groups.map((group) => (
        <div key={group.groupId}>
          <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted">
            {group.label}
          </h3>
          <div className="space-y-2 sm:space-y-1">
            {group.rows.map((row) => (
              <div
                key={row.id}
                className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-x-3 gap-y-1 text-sm sm:grid-cols-[10rem_3.5rem_minmax(0,1fr)_8rem_6rem]"
              >
                <span className="order-1 truncate">{row.name}</span>
                <span className="order-5 hidden text-right font-mono text-xs text-muted sm:order-2 sm:block">
                  {row.peakScore}/10
                </span>
                <div className="order-4 col-span-3 sm:order-3 sm:col-span-1">
                  <MeterBar
                    value={row.value}
                    max={max}
                    status={row.status}
                    ordinal={Boolean(row.ordinalNote)}
                  />
                </div>
                <span className="order-2 text-right font-mono text-xs sm:order-4">
                  {row.display}
                  {row.ordinalNote && (
                    <span className="ml-1 text-muted">{row.ordinalNote}</span>
                  )}
                </span>
                <span className="order-3 text-right sm:order-5 sm:pl-2 sm:text-left">
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
