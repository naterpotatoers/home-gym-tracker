import Link from "next/link";
import { BodyHeatmap } from "@/components/body-heatmap";
import { MeterLegend, MuscleMeterGroups } from "@/components/meter-rows";
import { ModalityChip } from "@/components/modality-chip";
import { LiftListControls } from "@/components/progress-controls";
import { SortableTable, type SortableRow } from "@/components/sortable-table";
import { Chip, Note, Section } from "@/components/ui";
import { VolumeControls, type VolumeFilter, type VolumeSort } from "@/components/volume-controls";
import { exerciseById } from "@/lib/data/exercises";
import { MUSCLE_GROUP_COLORS } from "@/lib/data/muscles";
import { modalityById } from "@/lib/data/modalities";
import type { GymData } from "@/lib/gym-data";
import { heatMax, heatValues, ordinalMax } from "@/lib/heat";
import { liftOverview, sessionTopLifts, volumeMeterGroups } from "@/lib/progress";
import { progressHref, type ProgressParams } from "@/lib/progress-url";
import { muscleVolume, sessionsFor } from "@/lib/queries";
import type { ClientId, MuscleGroupId } from "@/lib/types";

export function Overview({
  data,
  client,
  params,
}: {
  data: GymData;
  client: ClientId;
  params: ProgressParams;
}) {
  const lifts = liftOverview(data, client)
    .filter((row) => (params.mod ? row.modalityId === params.mod : true))
    .filter((row) =>
      params.group ? row.groupId === (params.group as MuscleGroupId) : true,
    );

  const liftRows: SortableRow[] = lifts.map((row) => ({
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
            <span
              className="size-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: MUSCLE_GROUP_COLORS[row.groupId] }}
              title={row.groupId}
            />
          )}
          <Link
            href={progressHref({ ...params, exercise: row.exerciseId, modality: row.modalityId })}
            className="text-accent-text underline underline-offset-2"
          >
            {exerciseById.get(row.exerciseId)?.name ?? row.exerciseId}
          </Link>
        </span>
      ),
      modality: <ModalityChip modalityId={row.modalityId} />,
      sessions: row.sessionCount,
      best: row.bestE1rmLbs === null ? "—" : `${Math.round(row.bestE1rmLbs)} lb`,
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
  }));
  const completed = sessionsFor(data, client).filter((s) => s.status === "completed");
  const recent = completed.slice(0, 10);

  const flatVolume = muscleVolume(data, client);
  const volumeHeatMax = heatMax({ volumes: flatVolume });
  const volumeHeat = heatValues(
    { volumes: flatVolume },
    volumeHeatMax,
    ordinalMax({ volumes: flatVolume }),
  );
  const meterGroups = volumeMeterGroups(
    data,
    client,
    params.sort as VolumeSort,
    params.filter as VolumeFilter,
  );

  return (
    <>
      <Section title="Lifts">
        <LiftListControls params={params} />
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
          />
        )}
        <Note>
          Trend is lb of e1RM per week over the last 90 days — it needs 3+
          sessions across 2+ weeks. Dot color = primary muscle group.
        </Note>
      </Section>

      <Section title="Recent workouts">
        {recent.length === 0 ? (
          <Note>Nothing completed yet.</Note>
        ) : (
          <ul className="space-y-2 text-sm">
            {recent.map((session) => {
              const tops = sessionTopLifts(data, session.id);
              return (
                <li key={session.id} className="flex flex-wrap items-center gap-2">
                  <Link
                    href={`/workout/session/${session.id}`}
                    className="font-mono text-xs text-accent-text underline underline-offset-2"
                  >
                    {session.date}
                  </Link>
                  <span className="font-semibold">
                    {data.routineById.get(session.routineId ?? "")?.name ?? "Session"}
                  </span>
                  {session.rpe !== null && <Chip>RPE {session.rpe}</Chip>}
                  {session.condition && <Chip>felt {session.condition}</Chip>}
                  {tops.length > 0 && (
                    <span className="text-xs text-muted">
                      {tops
                        .map(
                          (t) =>
                            `${exerciseById.get(t.exerciseId)?.name ?? t.exerciseId} ${Math.round(t.bestE1rmLbs)}`,
                        )
                        .join(" · ")}
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        )}
        <Note>
          {completed.length} completed session{completed.length === 1 ? "" : "s"} total —
          tap a date for the full workout.
        </Note>
      </Section>

      <Section title="Per-muscle volume (all time)">
        <VolumeControls params={params} />
        <div className="flex flex-col gap-8 lg:flex-row lg:items-start">
          <div className="min-w-0 flex-1">
            <MuscleMeterGroups groups={meterGroups} />
            <MeterLegend mode="volume" />
          </div>
          <div className="shrink-0">
            <BodyHeatmap
              values={volumeHeat}
              title="Body map"
              maxLabel={`${Math.round(volumeHeatMax).toLocaleString()} lb·reps`}
            />
          </div>
        </div>
        <Note>
          Volume is score-weighted: each set counts toward every muscle it
          trains, scaled by how directly it trains it. &ldquo;ord&rdquo; is
          hip-band work — reps, never pounds.
        </Note>
      </Section>
    </>
  );
}
