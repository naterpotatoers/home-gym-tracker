import Link from "next/link";
import { EyeIcon } from "@/components/icons";
import { ModalityChip } from "@/components/modality-chip";
import { Chip, Note, Section } from "@/components/ui";
import { exerciseById } from "@/lib/data/exercises";
import type { GymData } from "@/lib/gym-data";
import { sessionTopLifts } from "@/lib/progress";
import { blocksFor, describeSet, sessionsFor } from "@/lib/queries";
import type { ClientId } from "@/lib/types";

/**
 * One person's completed sessions as an in-place accordion list — shared by
 * the Users Metrics view and the per-person workout page. Native <details>:
 * every body is server-rendered (just the set lines), so opening is instant.
 */
export function RecentWorkouts({
  data,
  client,
  limit = 10,
}: {
  data: GymData;
  client: ClientId;
  limit?: number;
}) {
  const completed = sessionsFor(data, client).filter((s) => s.status === "completed");
  const recent = completed.slice(0, limit);

  return (
    <Section title="Recent workouts">
      {recent.length === 0 ? (
        <Note>Nothing completed yet.</Note>
      ) : (
        <ul className="divide-y divide-border text-sm">
          {recent.map((session) => {
            const tops = sessionTopLifts(data, session.id);
            return (
              <li key={session.id}>
                <details className="group">
                  <summary className="flex min-h-11 cursor-pointer list-none flex-wrap items-center gap-2 rounded-md px-1 py-1.5 hover:bg-current/5 [&::-webkit-details-marker]:hidden">
                    <span className="text-[10px] text-muted group-open:hidden">▸</span>
                    <span className="hidden text-[10px] text-muted group-open:inline">▾</span>
                    <span className="font-mono text-xs text-muted">{session.date}</span>
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
                  </summary>
                  <div className="space-y-3 px-1 pb-3 pl-6">
                    {blocksFor(data, session.id).map((block, i) => (
                      <div key={i}>
                        <h4 className="text-xs font-semibold">
                          {exerciseById.get(block.exerciseId)?.name ?? block.exerciseId}
                          <span className="ml-2 inline-flex items-center font-normal">
                            <ModalityChip modalityId={block.modalityId} />
                          </span>
                        </h4>
                        <ul className="mt-0.5 space-y-0.5 opacity-80">
                          {block.sets.map((set) => (
                            <li key={set.id} className="font-mono text-xs">
                              {set.setNumber}. {describeSet(data, set)}
                              {!set.completed && " · skipped"}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                    <Link
                      href={`/workout/session/${session.id}`}
                      className="inline-flex items-center gap-1 text-xs text-accent-text underline underline-offset-2"
                    >
                      <EyeIcon size={14} /> View session
                    </Link>
                  </div>
                </details>
              </li>
            );
          })}
        </ul>
      )}
      <Note>
        {completed.length} completed session{completed.length === 1 ? "" : "s"} total —
        tap a row for its sets.
      </Note>
    </Section>
  );
}
