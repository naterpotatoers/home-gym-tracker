import { ProgressChart } from "@/components/progress-chart";
import { Section } from "@/components/ui";
import { TARGET_RESULT_LABELS, type ConditioningSummary } from "@/lib/conditioning";
import { shortDayLabel } from "@/lib/periods";

/**
 * One person's bike work on their Progress tab, one block per series
 * (finisher pieces, then warm-ups): an "at the same effort" fitness line when
 * there's a fair comparison, best average watts per day as a line (only with
 * two or more days to compare), then the last few pieces with target,
 * readout, effort and how they compared. Kept apart from
 * Lifts — conditioning never enters a strength number.
 */
export function ConditioningSection({
  summaries,
  today,
}: {
  summaries: ConditioningSummary[];
  today: string;
}) {
  if (summaries.length === 0) return null;
  return (
    <Section title="Conditioning">
      <div className="space-y-6">
        {summaries.map((s) => (
          <div key={s.key}>
            <h3 className="text-sm font-semibold">{s.name}</h3>
            {s.fitness && <p className="mt-0.5 font-mono text-xs">{s.fitness}</p>}
            {s.points.length >= 2 && (
              <div className="mt-2">
                <ProgressChart points={s.points} label={`${s.name} average watts over time`} unit="W" />
              </div>
            )}
            <ul className="mt-2 divide-y divide-border border-t border-border text-sm">
              {s.recent.map((p) => (
                <li key={p.setId} className="flex min-h-11 flex-wrap items-center gap-x-3 gap-y-0.5 py-1">
                  <span className="w-20 shrink-0 text-muted">{shortDayLabel(p.date, today)}</span>
                  <span className="font-mono">{p.piece}</span>
                  {p.target && <span className="text-xs text-muted">target {p.target}</span>}
                  {p.readout && <span className="font-mono">{p.readout}</span>}
                  {p.effort !== null && <span className="text-xs text-muted">effort {p.effort}</span>}
                  {p.result && (
                    <span
                      className={`text-xs ${
                        p.result === "met"
                          ? "text-success-text"
                          : p.result === "well_above"
                            ? "font-semibold text-warning-text"
                            : "text-muted"
                      }`}
                    >
                      {TARGET_RESULT_LABELS[p.result]}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </Section>
  );
}
