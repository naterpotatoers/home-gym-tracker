import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeftIcon } from "@/components/icons";
import { WorkoutRunner } from "@/components/workout-runner";
import {
  Chip,
  chipClass,
  clientBorderStyle,
  ColorDot,
  PageShell,
  recapSetClass,
  Stat,
} from "@/components/ui";
import { ModalityChip } from "@/components/modality-chip";
import { catalogSlice } from "@/lib/exercise-catalog";
import { localDayLabel } from "@/lib/periods";
import { loadGymData } from "@/lib/db/snapshot";
import { bestE1rm } from "@/lib/modality";
import {
  availableVariants,
  blocksFor,
  describeSet,
  priorBestE1rm,
  recentVariantKeys,
  sessionVolumeLbs,
} from "@/lib/queries";
import { lbs } from "@/lib/format";
import { completedCount } from "@/lib/session-labels";

export default async function SessionPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;
  const data = await loadGymData();
  const session = data.sessionById.get(sessionId);
  if (!session) notFound();

  const client = data.clientById.get(session.clientId);

  // Completed or skipped: read-only recap.
  if (session.status !== "planned") {
    const blocks = blocksFor(data, session.id);
    const completedSets = blocks
      .flatMap((b) => b.sets)
      .filter((s) => s.completed && !s.isWarmup);
    const volumeLbs = sessionVolumeLbs(data, session.id);

    return (
      <PageShell className="max-w-3xl">
        <Link
          href="/workout"
          className={chipClass(false, "min-h-9 px-2.5 text-xs")}
        >
          <ArrowLeftIcon size={14} /> Back to workout
        </Link>

        {/* Who / when / how it went */}
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <ColorDot color={client?.color} size="lg" />
          <h1 className="text-2xl font-bold tracking-tight">
            {client?.firstName ?? session.clientId}
          </h1>
          <Chip>{session.status}</Chip>
          {session.rpe !== null && <Chip>RPE {session.rpe}</Chip>}
          {session.condition && <Chip>felt {session.condition}</Chip>}
        </div>
        <p className="mt-1 text-sm text-muted">
          {localDayLabel(session.date)}
          {session.routineId && (
            <> · {data.routineById.get(session.routineId)?.name ?? "routine"}</>
          )}
        </p>
        {session.notes && (
          <p className="mt-2 border-l-2 border-border pl-3 text-sm italic text-muted">
            {session.notes}
          </p>
        )}

        <dl className="mt-5 flex flex-wrap gap-x-8 gap-y-2 rounded-xl border border-border bg-surface px-4 py-3">
          <Stat label="Working sets" value={String(completedSets.length)} />
          <Stat
            label="Volume"
            value={volumeLbs > 0 ? lbs(volumeLbs) : "—"}
          />
          <Stat
            label="Duration"
            value={
              session.durationMinutes !== null ? `${session.durationMinutes} min` : "—"
            }
          />
          <Stat label="Exercises" value={String(blocks.length)} />
        </dl>

        <div className="mt-6 space-y-3">
          {blocks.map((block, i) => {
            const sessionBest = bestE1rm(
              data,
              block.sets.filter((s) => s.completed && !s.isWarmup),
            );
            const prior =
              session.status === "completed"
                ? priorBestE1rm(
                    data,
                    session.clientId,
                    block.exerciseId,
                    block.modalityId,
                    session.id,
                    session.date,
                  )
                : null;
            const isPr =
              sessionBest !== null && prior !== null && sessionBest > prior;
            const done = completedCount(block.sets);
            return (
              <div
                key={i}
                className="rounded-xl border border-border bg-surface p-3"
                style={clientBorderStyle(client?.color ?? null)}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-sm font-semibold">
                    {data.exerciseById.get(block.exerciseId)?.name ?? block.exerciseId}
                  </h2>
                  <ModalityChip modalityId={block.modalityId} />
                  {block.sets[0].bandRole === "assistance" && (
                    <span className="text-xs text-muted">assisted</span>
                  )}
                  {isPr && (
                    <span className="rounded bg-success/15 px-1.5 py-0.5 text-xs font-semibold text-success-text">
                      PR · e1RM {lbs(sessionBest)} (prev {Math.round(prior)})
                    </span>
                  )}
                  <span className="ml-auto font-mono text-xs text-muted">
                    {done}/{block.sets.length} sets
                  </span>
                </div>
                <ul className="mt-2 space-y-0.5">
                  {block.sets.map((set) => (
                    <li
                      key={set.id}
                      className={`font-mono text-xs ${recapSetClass(set.completed)}`}
                    >
                      {set.setNumber}. {describeSet(data, set)}
                      {!set.completed && " · skipped"}
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>

        <p className="mt-8">
          <Link href="/workout" className={chipClass(false, "min-h-9 px-2.5 text-xs")}>
            <ArrowLeftIcon size={14} /> Back to workout
          </Link>
        </p>
      </PageShell>
    );
  }

  // Planned: the live runner.
  const prescriptions = session.routineId
    ? (data.exercisesByRoutine.get(session.routineId) ?? [])
    : [];

  return (
    <PageShell>
      <WorkoutRunner
        session={session}
        initialSets={data.setsBySession.get(session.id) ?? []}
        prescriptions={prescriptions}
        variants={availableVariants(data)}
        catalog={catalogSlice(data)}
        clientName={client?.firstName ?? session.clientId}
        recentKeys={recentVariantKeys(data, session.clientId)}
      />
    </PageShell>
  );
}
