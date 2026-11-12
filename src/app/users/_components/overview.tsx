import Link from "next/link";
import { BodyHeatmap } from "@/components/body-heatmap";
import { ArrowLeftIcon } from "@/components/icons";
import { LiftList, type LiftListRow } from "@/components/lift-list";
import { RecentWorkouts } from "@/components/recent-workouts";
import { RunningSection } from "@/components/running-section";
import { Caret, chipClass, Note, Section, summaryClass } from "@/components/ui";
import { MUSCLE_GROUP_COLORS, muscleGroups } from "@/lib/data/muscles";
import { modalityById } from "@/lib/data/modalities";
import { catalogSlice } from "@/lib/exercise-catalog";
import type { GymData } from "@/lib/gym-data";
import { heatMax, heatValues, ordinalMax } from "@/lib/heat";
import { MUSCLE_SPANS, muscleSpanRange } from "@/lib/muscle-span";
import { liftOverview } from "@/lib/progress";
import { progressHref, type ProgressParams } from "@/lib/progress-url";
import { muscleVolume } from "@/lib/queries";
import { relativeDayLabel } from "@/lib/periods";
import { runnerSummary } from "@/lib/running";
import { isModalityId } from "@/lib/validate";
import type { ClientId } from "@/lib/types";
import { LiftHistory } from "./exercise-view";
import { dash, lbs } from "@/lib/format";

export function Overview({
  data,
  client,
  params,
  personName,
  today,
  stravaAthlete = false,
}: {
  data: GymData;
  client: ClientId;
  params: ProgressParams;
  personName: string;
  today: string;
  /** This person's runs sync from Strava (strava.ts is server-only, so the
   *  page decides). */
  stravaAthlete?: boolean;
}) {
  const lifts = liftOverview(data, client);
  // exercise/modality URL params name the selected lift. Without one, md+
  // shows the most recent lift; phones show just the list until a tap.
  const explicit =
    data.exerciseById.has(params.exercise) && isModalityId(params.modality)
      ? { exerciseId: params.exercise, modalityId: params.modality }
      : null;
  const selected =
    explicit ??
    (lifts[0] ? { exerciseId: lifts[0].exerciseId, modalityId: lifts[0].modalityId } : null);

  const liftRows: LiftListRow[] = lifts.map((row) => {
    const exercise = data.exerciseById.get(row.exerciseId);
    const gear = modalityById.get(row.modalityId)?.name ?? row.modalityId;
    const group = muscleGroups.find((g) => g.id === row.groupId)?.label;
    const trend = row.trendPerWeek;
    return {
      key: `${row.exerciseId}-${row.modalityId}`,
      href: progressHref({ ...params, exercise: row.exerciseId, modality: row.modalityId }),
      name: exercise?.name ?? row.exerciseId,
      gear,
      groupColor: row.groupId ? MUSCLE_GROUP_COLORS[row.groupId] : null,
      best: dash(row.bestE1rmLbs, lbs),
      arrow: trend === null || Math.abs(trend) <= 0.05 ? null : trend > 0 ? "up" : "down",
      lastLabel: relativeDayLabel(row.lastDate, today),
      selected:
        selected?.exerciseId === row.exerciseId && selected.modalityId === row.modalityId,
      search: [exercise?.name ?? row.exerciseId, ...(exercise?.aliases ?? []), gear, group ?? ""],
    };
  });
  const span = muscleSpanRange(data, client, params.span, today);
  const volume = muscleVolume(data, client, { from: span.from, to: span.to });
  const volumeHeatMax = heatMax({ volumes: volume });
  const volumeOrdinalMax = ordinalMax({ volumes: volume });
  const volumeHeat = heatValues({ volumes: volume }, volumeHeatMax, volumeOrdinalMax);

  return (
    <>
      <Section title="Lifts">
        {lifts.length === 0 ? (
          <Note>No lifts logged yet.</Note>
        ) : (
          // The list pins beside the history and scrolls inside itself, so a
          // long lift list never leaves a blank gap under a short history.
          <div className="md:grid md:grid-cols-[15rem_1fr] md:items-start md:gap-6">
            <div className={`${explicit ? "hidden md:block" : ""} md:sticky md:top-20`}>
              <LiftList rows={liftRows} />
            </div>
            {selected && (
              <div className={explicit ? "min-w-0" : "hidden min-w-0 md:block"}>
                <Link
                  href={progressHref({ ...params, exercise: "", modality: "" })}
                  scroll={false}
                  className={`${chipClass(false, "min-h-11 px-2.5 text-xs")} mb-3 md:hidden`}
                >
                  <ArrowLeftIcon size={14} /> All lifts
                </Link>
                <LiftHistory
                  key={`${selected.exerciseId}-${selected.modalityId}`}
                  data={data}
                  client={client}
                  personName={personName}
                  exerciseId={selected.exerciseId}
                  modalityId={selected.modalityId}
                />
              </div>
            )}
          </div>
        )}
      </Section>

      <RecentWorkouts data={data} client={client} limit={5} showTotal={false} />

      {data.runsSource === "missing" ? (
        <p className="mt-10 rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-xs">
          Running isn&apos;t set up yet — run{" "}
          <code className="font-mono">supabase/migrations/2026-11-07-runs.sql</code> in the
          Supabase SQL editor, then reload.
        </p>
      ) : (
        <RunningSection runner={runnerSummary(data, client, today, stravaAthlete)} today={today} />
      )}

      <Section
        title="Muscle work"
        action={
          <nav aria-label="Muscle work range" className="flex gap-1">
            {MUSCLE_SPANS.map((s) => (
              <Link
                key={s.id}
                scroll={false}
                href={progressHref({ ...params, span: s.id })}
                aria-current={params.span === s.id ? "page" : undefined}
                className={chipClass(params.span === s.id)}
              >
                {s.label}
              </Link>
            ))}
          </nav>
        }
      >
        <BodyHeatmap
          values={[...volumeHeat]}
          catalog={catalogSlice(data)}
          title={span.label}
          maxLabel={`${Math.round(volumeHeatMax).toLocaleString()} lb·reps`}
          ordinalMaxLabel={
            volumeOrdinalMax > 0 ? `${Math.round(volumeOrdinalMax)} reps` : undefined
          }
        />
      </Section>

      <details className="group mt-8 rounded-xl border border-border">
        <summary className={summaryClass("rounded-xl px-4 py-2 text-sm font-semibold")}>
          <Caret /> How numbers work
        </summary>
        <div className="space-y-2 px-4 pb-4 text-xs leading-relaxed text-muted">
          <p>
            <strong className="text-foreground">Est. max</strong> is an estimated
            one-rep max (Epley: {"load × (1 + reps/30)"}) from completed working
            sets — warmups never count. Dumbbell loads are total pounds across both
            implements; bodyweight-gear estimates move with weigh-ins. ▲/▼ beside it
            means it&apos;s trending up or down over the last 90 days (needs 3+
            sessions across 2+ weeks).
          </p>
          <p>
            <strong className="text-foreground">Sessions</strong> list every working
            set as entered — dumbbells per hand, bands by color, &quot;F&quot; = to
            failure — and the dot beside a lift is its primary muscle group.
          </p>
          <p>
            <strong className="text-foreground">Muscle work</strong> is score-weighted
            volume: each set counts toward every muscle it trains, scaled by how
            directly it trains it. Tap a region for its numbers; hatched regions are
            hip-band work — reps, never pounds — on their own scale. Dashed outlines
            mark deep muscles drawn as callouts.
          </p>
        </div>
      </details>
    </>
  );
}
