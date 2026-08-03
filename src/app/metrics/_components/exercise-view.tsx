import Link from "next/link";
import { ProgressChart, type ChartPoint } from "@/components/progress-chart";
import { LoadExplorerControls } from "@/components/progress-controls";
import { Note, Section, Stat } from "@/components/ui";
import { exerciseById } from "@/lib/data/exercises";
import { modalityById } from "@/lib/data/modalities";
import type { GymData } from "@/lib/gym-data";
import { e1rmTrend, exerciseHistory, trendSegment } from "@/lib/progress";
import { progressHref, type ProgressParams } from "@/lib/progress-url";
import {
  hipBandLadder,
  prComparison,
  repRangeForWeight,
  workingWeightForRepRange,
} from "@/lib/queries";
import type { ClientId, ExerciseId, ModalityId } from "@/lib/types";
import { HistoryTable } from "./history-table";

export function ExerciseView({
  data,
  client,
  personName,
  exerciseId,
  modalityId,
  params,
}: {
  data: GymData;
  client: ClientId;
  personName: string;
  exerciseId: ExerciseId;
  modalityId: ModalityId;
  params: ProgressParams;
}) {
  const exerciseName = exerciseById.get(exerciseId)?.name ?? exerciseId;
  const modalityName = modalityById.get(modalityId)?.name ?? modalityId;
  const history = exerciseHistory(data, client, exerciseId, modalityId);
  const ordinalOnly = history.length > 0 && history.every((p) => p.bestE1rmLbs === null);
  const trend = ordinalOnly ? null : e1rmTrend(history);
  const compare = prComparison(data, exerciseId, modalityId);

  const points: ChartPoint[] = history
    .filter((p) => p.bestE1rmLbs !== null)
    .map((p) => ({
      date: p.date,
      y: p.bestE1rmLbs!,
      sessionId: p.sessionId,
      detail: `${p.date} · ${
        p.topSet ? `${Math.round(p.topSet.weightLbs)} lb × ${p.topSet.reps}` : "—"
      } · e1RM ${Math.round(p.bestE1rmLbs!)} lb`,
    }));

  const bestAll = points.reduce((max, p) => Math.max(max, p.y), 0);
  const rangeAnswer = workingWeightForRepRange(
    data, client, exerciseId, modalityId, params.repMin, params.repMax,
  );
  const weightAnswer = repRangeForWeight(data, client, exerciseId, modalityId, params.weight);

  return (
    <Section title={`${exerciseName} — ${modalityName}`}>
      <p className="-mt-2 mb-4">
        <Link
          href={progressHref({ ...params, exercise: "", modality: "" })}
          className="text-xs text-accent-text underline underline-offset-2"
        >
          ← back to overview
        </Link>
      </p>

      {history.length === 0 ? (
        <Note>No logged sets for {personName} on this variant.</Note>
      ) : ordinalOnly ? (
        <>
          <Note>
            Hip-band work is ordinal — band rank and reps, never pounds — so
            there is no e1RM line to draw. Progress here is moving down the
            ladder:{" "}
            {hipBandLadder()
              .map(({ band, rank }) => `${rank}. ${band.label}`)
              .join(" · ")}
            . Smaller is harder.
          </Note>
          <HistoryTable history={history} />
        </>
      ) : (
        <>
          <dl className="mb-4 flex flex-wrap gap-x-8 gap-y-2">
            <Stat label="Best e1RM" value={`${Math.round(bestAll)} lb`} />
            <Stat label="Sessions" value={String(history.length)} />
            <Stat
              label="Trend"
              value={
                trend === null
                  ? "—"
                  : `${trend.slopePerWeek >= 0 ? "+" : ""}${trend.slopePerWeek.toFixed(1)} lb/wk`
              }
              valueClassName={
                trend === null
                  ? ""
                  : trend.slopePerWeek > 0.05
                    ? "text-success-text"
                    : trend.slopePerWeek < -0.05
                      ? "text-danger-text"
                      : ""
              }
            />
            <Stat
              label="Projected 4 wk"
              value={trend === null ? "—" : `${Math.round(trend.projected4wkLbs)} lb`}
            />
            <Stat
              label="Projected 8 wk"
              value={trend === null ? "—" : `${Math.round(trend.projected8wkLbs)} lb`}
            />
          </dl>

          {points.length > 0 && (
            <ProgressChart
              points={points}
              trend={trend === null ? null : trendSegment(trend)}
            />
          )}

          <div className="mt-6 rounded-xl border border-border bg-surface p-4 text-sm">
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">
              Load explorer
            </h3>
            <p className="flex flex-wrap items-center gap-2">
              <span>Weight for</span>
              <LoadExplorerControls params={params} field="reps" />
              <span>reps:</span>
              <span className="font-mono font-semibold">
                {rangeAnswer.predicted === null
                  ? "—"
                  : `${Math.round(rangeAnswer.predicted)} lb`}
              </span>
              {rangeAnswer.suggestedBarLoad !== null && (
                <span className="text-xs text-muted">
                  (bar: {rangeAnswer.suggestedBarLoad} lb)
                </span>
              )}
              {rangeAnswer.bestActual && (
                <span className="text-xs text-muted">
                  best actual: {Math.round(rangeAnswer.bestActual.weightLbs)} lb ×{" "}
                  {rangeAnswer.bestActual.reps} ({rangeAnswer.bestActual.date})
                </span>
              )}
            </p>
            <p className="mt-2 flex flex-wrap items-center gap-2">
              <span>Reps at</span>
              <LoadExplorerControls params={params} field="weight" />
              <span>lb:</span>
              <span className="font-mono font-semibold">
                {weightAnswer.predictedReps === null
                  ? "—"
                  : `~${Math.floor(weightAnswer.predictedReps)}`}
              </span>
              {weightAnswer.bestActual && (
                <span className="text-xs text-muted">
                  best actual: {weightAnswer.bestActual.reps} ×{" "}
                  {Math.round(weightAnswer.bestActual.weightLbs)} lb (
                  {weightAnswer.bestActual.date})
                </span>
              )}
            </p>
          </div>

          <HistoryTable history={history} />
        </>
      )}

      <div className="mt-6">
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">
          Everyone on this lift
        </h3>
        <ul className="space-y-1 text-sm">
          {compare.map((row) => (
            <li
              key={row.clientId}
              className={`flex flex-wrap items-baseline gap-3 ${
                row.clientId === client ? "font-semibold text-accent-text" : ""
              }`}
            >
              <span className="inline-flex w-24 items-center gap-1.5">
                {data.clientById.get(row.clientId)?.color && (
                  <span
                    className="size-2.5 rounded-full"
                    style={{ backgroundColor: data.clientById.get(row.clientId)!.color! }}
                  />
                )}
                {data.clientById.get(row.clientId)?.firstName ?? row.clientId}
              </span>
              <span className="font-mono">
                {row.bestE1rmLbs === null ? "—" : `${Math.round(row.bestE1rmLbs)} lb`}
              </span>
              {row.relative !== null && (
                <span className="font-mono text-xs text-muted">
                  {row.relative.toFixed(2)}×BW
                </span>
              )}
              {row.date && <span className="text-xs text-muted">{row.date}</span>}
            </li>
          ))}
        </ul>
      </div>

      <Note>
        e1RM is Epley ({"load × (1 + reps/30)"}) over completed working sets —
        warmups never count. Dumbbell loads are total pounds across both
        implements; bodyweight-modality e1RMs move with weigh-ins.
      </Note>
    </Section>
  );
}
