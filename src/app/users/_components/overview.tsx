import Link from "next/link";
import { ArrowLeftIcon, HeartIcon } from "@/components/icons";
import { LiftList, type LiftListRow } from "@/components/lift-list";
import { RecentWorkouts } from "@/components/recent-workouts";
import { Caret, chipClass, FOCUS_RING, Note, Section, summaryClass } from "@/components/ui";
import { MUSCLE_GROUP_COLORS, muscleGroups } from "@/lib/data/muscles";
import { modalityById } from "@/lib/data/modalities";
import type { GymData } from "@/lib/gym-data";
import { liftOverview } from "@/lib/progress";
import { progressHref, type ProgressParams } from "@/lib/progress-url";
import { relativeDayLabel } from "@/lib/periods";
import { cardioWeekLine } from "@/lib/running";
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
}: {
  data: GymData;
  client: ClientId;
  params: ProgressParams;
  personName: string;
  today: string;
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
  // Runs and bike pieces live on the Cardio tab; Progress keeps one line.
  const cardioLine = cardioWeekLine(data, client, today);

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

      {cardioLine && (
        <Link
          href={progressHref({ ...params, view: "cardio", exercise: "", modality: "" })}
          className={`mt-8 flex min-h-11 items-center gap-2 rounded-lg border border-border bg-surface-alt px-3 text-sm hover:bg-current/5 ${FOCUS_RING}`}
        >
          <HeartIcon size={16} />
          <span className="text-muted">Cardio this week:</span>
          <span className="font-mono">{cardioLine}</span>
          <span className="ml-auto text-accent-text">Cardio →</span>
        </Link>
      )}

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
        </div>
      </details>
    </>
  );
}
