import { notFound } from "next/navigation";
import { WorkoutRunner } from "@/components/workout-runner";
import { BackLink, Chip, clientBorderStyle, ColorDot, PageShell, Stat } from "@/components/ui";
import { ModalityChip } from "@/components/modality-chip";
import { livePerson } from "@/lib/live-session";
import { catalogSlice } from "@/lib/exercise-catalog";
import { localDayLabel } from "@/lib/periods";
import { loadGymData } from "@/lib/db/snapshot";
import { availableVariants, sessionRecap } from "@/lib/queries";
import { lbs } from "@/lib/format";
import { SetRecap } from "@/components/set-recap";

export default async function SessionPage({
  params,
  searchParams,
}: {
  params: Promise<{ sessionId: string }>;
  /** `board`: the group board's session ids, when opened from a board card's
   *  recap link — the back link then returns to that board. */
  searchParams: Promise<{ board?: string }>;
}) {
  const [{ sessionId }, { board }] = await Promise.all([params, searchParams]);
  const data = await loadGymData();
  const session = data.sessionById.get(sessionId);
  if (!session) notFound();

  const client = data.clientById.get(session.clientId);

  // Completed or skipped: read-only recap.
  if (session.status !== "planned") {
    const { blocks, workingSets, volumeLbs } = sessionRecap(data, session.id);

    return (
      <PageShell>
        {/* Reading width, left edge still lined up with the nav. */}
        <div className="max-w-3xl">
          <BackLink href={board ? `/workout/group/board?s=${encodeURIComponent(board)}` : "/"}>
            {board ? "Back to the board" : "Back to workout"}
          </BackLink>

          {/* Who / when / how it went */}
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <ColorDot color={client?.color} size="lg" />
            <h1 className="text-2xl font-bold tracking-tight">
              {client?.firstName ?? session.clientId}
            </h1>
            {session.status === "skipped" && <Chip>skipped</Chip>}
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
            <Stat label="Working sets" value={String(workingSets)} />
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
            {blocks.map((block) => (
                <div
                  key={block.key}
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
                    {block.pr && (
                      <span className="rounded bg-success/15 px-1.5 py-0.5 text-xs font-semibold text-success-text">
                        PR · e1RM {lbs(block.pr.bestLbs)} (prev {lbs(block.pr.priorLbs)})
                      </span>
                    )}
                    <span className="ml-auto font-mono text-xs text-muted">
                      {block.done}/{block.sets.length} sets
                    </span>
                  </div>
                  <div className="mt-2">
                    <SetRecap data={data} sets={block.sets} />
                  </div>
                </div>
            ))}
          </div>
        </div>
      </PageShell>
    );
  }

  // Planned: the live runner.
  const person = livePerson(data, session);
  return (
    <PageShell>
      <WorkoutRunner {...person} variants={availableVariants(data)} catalog={catalogSlice(data)} />
    </PageShell>
  );
}
