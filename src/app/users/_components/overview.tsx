import Link from "next/link";
import { BodyHeatmap } from "@/components/body-heatmap";
import { ModalityChip } from "@/components/modality-chip";
import { LiftListControls } from "@/components/progress-controls";
import { RecentWorkouts } from "@/components/recent-workouts";
import { SortableTable, type SortableRow } from "@/components/sortable-table";
import { ColorDot, Note, Section } from "@/components/ui";
import { exerciseById } from "@/lib/data/exercises";
import { MUSCLE_GROUP_COLORS } from "@/lib/data/muscles";
import { modalityById } from "@/lib/data/modalities";
import type { GymData } from "@/lib/gym-data";
import { heatMax, heatValues, ordinalMax } from "@/lib/heat";
import { liftOverview } from "@/lib/progress";
import { progressHref, type ProgressParams } from "@/lib/progress-url";
import { muscleVolume } from "@/lib/queries";
import { isExerciseId, isModalityId } from "@/lib/validate";
import type { ClientId, MuscleGroupId } from "@/lib/types";
import { ExerciseDetail } from "./exercise-view";
import { dash, lbs } from "@/lib/format";

export function Overview({
  data,
  client,
  params,
  personName,
}: {
  data: GymData;
  client: ClientId;
  params: ProgressParams;
  personName: string;
}) {
  // The Lifts table's accordion state: exercise/modality URL params name the
  // one expanded row; the server renders only that detail.
  const selected =
    isExerciseId(params.exercise) && isModalityId(params.modality)
      ? { exerciseId: params.exercise, modalityId: params.modality }
      : null;
  const lifts = liftOverview(data, client)
    .filter((row) => (params.mod ? row.modalityId === params.mod : true))
    .filter((row) =>
      params.group ? row.groupId === (params.group as MuscleGroupId) : true,
    );

  const liftRows: SortableRow[] = lifts.map((row) => {
    const isOpen =
      selected !== null &&
      selected.exerciseId === row.exerciseId &&
      selected.modalityId === row.modalityId;
    return {
    key: `${row.exerciseId}-${row.modalityId}`,
    sort: {
      exercise: exerciseById.get(row.exerciseId)?.name ?? row.exerciseId,
      modality: modalityById.get(row.modalityId)?.name ?? row.modalityId,
      sessions: row.sessionCount,
      best: row.bestE1rmLbs,
      trend: row.trendPerWeek,
      last: row.lastDate,
    },
    cells: {
      exercise: (
        <span className="inline-flex items-center gap-1.5">
          {row.groupId && (
            <ColorDot color={MUSCLE_GROUP_COLORS[row.groupId]} title={row.groupId} />
          )}
          <Link
            scroll={false}
            href={progressHref({
              ...params,
              exercise: isOpen ? "" : row.exerciseId,
              modality: isOpen ? "" : row.modalityId,
            })}
            className={`inline-flex min-h-9 items-center gap-1 ${
              isOpen
                ? "font-semibold text-accent-text"
                : "text-accent-text underline underline-offset-2"
            }`}
            aria-expanded={isOpen}
          >
            <span className="text-[10px]">{isOpen ? "▾" : "▸"}</span>
            {exerciseById.get(row.exerciseId)?.name ?? row.exerciseId}
          </Link>
        </span>
      ),
      modality: <ModalityChip modalityId={row.modalityId} />,
      sessions: row.sessionCount,
      best: dash(row.bestE1rmLbs, lbs),
      trend:
        row.trendPerWeek === null ? (
          <span className="text-muted">—</span>
        ) : (
          <span
            className={
              row.trendPerWeek > 0.05
                ? "text-success-text"
                : row.trendPerWeek < -0.05
                  ? "text-danger-text"
                  : "text-muted"
            }
          >
            {row.trendPerWeek > 0.05 ? "▲" : row.trendPerWeek < -0.05 ? "▼" : "→"}{" "}
            {row.trendPerWeek >= 0 ? "+" : ""}
            {row.trendPerWeek.toFixed(1)}
          </span>
        ),
      last: row.lastDate,
    },
    };
  });
  const flatVolume = muscleVolume(data, client);
  const volumeHeatMax = heatMax({ volumes: flatVolume });
  const volumeHeat = heatValues(
    { volumes: flatVolume },
    volumeHeatMax,
    ordinalMax({ volumes: flatVolume }),
  );

  return (
    <>
      <RecentWorkouts data={data} client={client} />

      <Section title="Muscle volume (all time)">
        <BodyHeatmap
          values={volumeHeat}
          title="Body map"
          maxLabel={`${Math.round(volumeHeatMax).toLocaleString()} lb·reps`}
        />
        <Note>
          Volume is score-weighted: each set counts toward every muscle it
          trains, scaled by how directly it trains it. Tap a region for its
          numbers; hatched regions are hip-band work — reps, never pounds.
        </Note>
      </Section>

      <Section title="Lifts">
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <LiftListControls params={params} />
        </div>
        {lifts.length === 0 ? (
          <Note>No lifts match — clear a filter or log some sets.</Note>
        ) : (
          <SortableTable
            columns={[
              { key: "exercise", label: "Exercise" },
              { key: "modality", label: "Modality" },
              { key: "sessions", label: "Sessions", numeric: true },
              { key: "best", label: "Best e1RM", numeric: true },
              { key: "trend", label: "Trend", numeric: true },
              { key: "last", label: "Last" },
            ]}
            rows={liftRows}
            initialSort={{ key: "best", dir: "desc" }}
            expandedKey={
              selected ? `${selected.exerciseId}-${selected.modalityId}` : undefined
            }
            expansion={
              selected ? (
                <ExerciseDetail
                  data={data}
                  client={client}
                  personName={personName}
                  exerciseId={selected.exerciseId}
                  modalityId={selected.modalityId}
                  params={params}
                />
              ) : undefined
            }
          />
        )}
        <Note>
          Tap a lift for its full history, chart, and load explorer. Trend is
          lb of e1RM per week over the last 90 days — it needs 3+ sessions
          across 2+ weeks. Dot color = primary muscle group.
        </Note>
      </Section>
    </>
  );
}
