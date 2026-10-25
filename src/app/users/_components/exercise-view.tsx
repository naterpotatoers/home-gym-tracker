import Link from "next/link";
import { ProgressChart } from "@/components/progress-chart";
import { Caret, Note, summaryClass } from "@/components/ui";
import { modalityById } from "@/lib/data/modalities";
import type { GymData } from "@/lib/gym-data";
import type { ChartPoint } from "@/lib/meters";
import { shortDayLabel } from "@/lib/periods";
import { e1rmTrend, exerciseHistory, type ExerciseHistoryPoint } from "@/lib/progress";
import { compactSet, hipBandLadder } from "@/lib/queries";
import type { ClientId, ExerciseId, ModalityId } from "@/lib/types";
import { lbs } from "@/lib/format";

/** Sessions shown before the "Show all" fold. */
const RECENT = 12;

/** One lift's history — the Progress tab's main pane: est. max + trend in
 *  words, the chart, then every session with every working set. */
export function LiftHistory({
  data,
  client,
  personName,
  exerciseId,
  modalityId,
}: {
  data: GymData;
  client: ClientId;
  personName: string;
  exerciseId: ExerciseId;
  modalityId: ModalityId;
}) {
  const exerciseName = data.exerciseById.get(exerciseId)?.name ?? exerciseId;
  const modalityName = modalityById.get(modalityId)?.name ?? modalityId;
  const history = exerciseHistory(data, client, exerciseId, modalityId);
  const ordinalOnly = history.length > 0 && history.every((p) => p.bestE1rmLbs === null);
  const trend = ordinalOnly ? null : e1rmTrend(history);
  const newestFirst = [...history].reverse();

  let best: ExerciseHistoryPoint | null = null;
  for (const p of history) {
    if (p.bestE1rmLbs !== null && (best === null || p.bestE1rmLbs > best.bestE1rmLbs!)) best = p;
  }
  const slope = trend?.slopePerWeek ?? 0;
  const trendText =
    trend === null || Math.abs(slope) <= 0.05
      ? null
      : `${slope > 0 ? "▲" : "▼"} ${Math.abs(slope).toFixed(1)} lb/wk over 90 days`;

  const points: ChartPoint[] = history
    .filter((p) => p.bestE1rmLbs !== null)
    .map((p) => ({
      date: p.date,
      y: p.bestE1rmLbs!,
      sessionId: p.sessionId,
      detail: `${p.date} · ${
        p.topSet ? `${lbs(p.topSet.weightLbs)} × ${p.topSet.reps}` : "—"
      } · est. max ${lbs(p.bestE1rmLbs!)}`,
    }));

  const rows = (points: ExerciseHistoryPoint[]) => (
    <ul className="divide-y divide-border">
      {points.map((p) => (
        <li key={p.sessionId} className="flex items-start gap-3 py-1.5">
          <Link
            href={`/workout/session/${p.sessionId}`}
            className="inline-flex min-h-9 w-16 shrink-0 items-center rounded-sm text-xs text-accent-text hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 pointer-coarse:min-h-11"
          >
            {shortDayLabel(p.date)}
          </Link>
          <span className="flex min-h-9 flex-1 flex-wrap items-center gap-1 pointer-coarse:min-h-11">
            {p.sets.map((set) => (
              <span
                key={set.id}
                className="rounded bg-current/10 px-1.5 py-0.5 font-mono text-xs"
              >
                {compactSet(data, set)}
              </span>
            ))}
            {best?.sessionId === p.sessionId && (
              <span className="rounded bg-success/15 px-1.5 py-0.5 text-xs font-semibold text-success-text">
                best
              </span>
            )}
          </span>
        </li>
      ))}
    </ul>
  );

  return (
    <div>
      <h2 className="text-lg font-semibold">
        {exerciseName} <span className="font-normal text-muted">· {modalityName}</span>
      </h2>
      {best && (
        <p className="mt-0.5 text-sm">
          Est. max <span className="font-mono font-semibold">{lbs(best.bestE1rmLbs!)}</span>
          {trendText && (
            <span className={`ml-2 text-xs ${slope > 0 ? "text-success-text" : "text-danger-text"}`}>
              {trendText}
            </span>
          )}
        </p>
      )}

      {history.length === 0 ? (
        <Note>No logged sets for {personName} on this variant.</Note>
      ) : (
        <>
          {ordinalOnly ? (
            <Note>
              Hip-band work is ordinal — band rank and reps, never pounds — so
              there is no line to draw. Progress here is moving down the ladder:{" "}
              {hipBandLadder()
                .map(({ band, rank }) => `${rank}. ${band.label}`)
                .join(" · ")}
              . Smaller is harder.
            </Note>
          ) : (
            points.length > 0 && (
              <div className="mt-3">
                <ProgressChart key={client} points={points} trend={null} />
              </div>
            )
          )}

          <h3 className="mt-4 text-xs font-semibold uppercase tracking-wide text-muted">
            Sessions
          </h3>
          {rows(newestFirst.slice(0, RECENT))}
          {newestFirst.length > RECENT && (
            <details className="group">
              <summary className={summaryClass("rounded-md px-1 py-1 text-xs text-muted")}>
                <Caret /> Show all {newestFirst.length}
              </summary>
              {rows(newestFirst.slice(RECENT))}
            </details>
          )}
        </>
      )}
    </div>
  );
}
