import Link from "next/link";
import { EyeIcon } from "@/components/icons";
import { ModalityChip } from "@/components/modality-chip";
import { Caret, Chip, Note, Section, summaryClass } from "@/components/ui";
import type { GymData } from "@/lib/gym-data";
import { sessionTopLifts } from "@/lib/progress";
import { blocksFor, sessionsFor } from "@/lib/queries";
import type { ClientId } from "@/lib/types";
import { completedCount } from "@/lib/session-labels";
import { plural } from "@/lib/format";
import { shortDayLabel, localTodayIso } from "@/lib/periods";
import { SetRecap } from "@/components/set-recap";

/**
 * One person's completed sessions as an in-place accordion list — shared by
 * the Users Metrics view and the per-person workout page. Native <details>:
 * every body is server-rendered (just the set lines), so opening is instant.
 */
export function RecentWorkouts({
  data,
  client,
  limit = 10,
  showTotal = true,
}: {
  data: GymData;
  client: ClientId;
  limit?: number;
  /** The "N completed total" footer — off where a header already counts. */
  showTotal?: boolean;
}) {
  const completed = sessionsFor(data, client).filter((s) => s.status === "completed");
  const today = localTodayIso();
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
                  <summary className={summaryClass("rounded-md px-1 py-1.5")}>
                    <Caret />
                    <span className="w-24 shrink-0 text-xs text-muted">{shortDayLabel(session.date, today)}</span>
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
                              `${data.exerciseById.get(t.exerciseId)?.name ?? t.exerciseId} ${Math.round(t.bestE1rmLbs)}`,
                          )
                          .join(" · ")}
                      </span>
                    )}
                  </summary>
                  {/* Inset panel, blocks in a two-up grid with aligned set
                      numbers — same grouped-inset language as the workout
                      page's unfinished-sessions block. */}
                  <div className="mb-2 ml-5 mt-1 rounded-lg bg-background px-4 py-3">
                    <div className="grid gap-x-8 gap-y-3 sm:grid-cols-2">
                      {blocksFor(data, session.id).map((block) => {
                        const done = completedCount(block.sets);
                        return (
                          <div key={block.key} className="min-w-0">
                            <h4 className="flex items-center gap-1.5 text-xs font-semibold">
                              <span className="truncate">
                                {data.exerciseById.get(block.exerciseId)?.name ?? block.exerciseId}
                              </span>
                              <ModalityChip modalityId={block.modalityId} />
                              <span className="ml-auto shrink-0 font-mono text-[10px] font-normal text-muted">
                                {done}/{block.sets.length}
                              </span>
                            </h4>
                            <div className="mt-1">
                              <SetRecap data={data} sets={block.sets} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    <div className="mt-3 border-t border-border pt-2">
                      <Link
                        href={`/workout/session/${session.id}`}
                        className="inline-flex min-h-9 items-center gap-1 text-xs text-accent-text underline underline-offset-2 pointer-coarse:min-h-11"
                      >
                        <EyeIcon size={14} /> View session
                      </Link>
                    </div>
                  </div>
                </details>
              </li>
            );
          })}
        </ul>
      )}
      {showTotal ? (
        <Note>
          {plural(completed.length, "completed session")} total —
          tap a row for its sets.
        </Note>
      ) : (
        recent.length > 0 && <Note>Tap a row for its sets.</Note>
      )}
    </Section>
  );
}
