"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { GroupPersonCard } from "@/components/group-person-card";
import { ArrowLeftIcon } from "@/components/icons";
import { chipClass, ColorDot } from "@/components/ui";
import { useSessionClock } from "@/components/use-session-clock";
import { useWakeLock } from "@/components/use-wake-lock";
import type { ExerciseCatalog } from "@/lib/exercise-catalog";
import type { VariantSessionSummary } from "@/lib/progress";
import type { Variant } from "@/lib/queries";
import type { RoutineExercise, Session, SetLog } from "@/lib/types";

export type BoardPerson = {
  session: Session;
  initialSets: SetLog[];
  prescriptions: RoutineExercise[];
  clientName: string;
  routineName: string;
  /** Preset swatch hex from the person's profile — tints their card. */
  color: string | null;
  /** This person's recently trained variants, for the picker's Recent group. */
  recentKeys?: string[];
  /** Last sessions per variant, for each block's "Last" line. */
  history?: Record<string, VariantSessionSummary[]>;
  /** The session was already completed when the page rendered. */
  finished: boolean;
};

/** What a card reports up for the portrait person tabs. */
export type CardStatus = {
  done: number;
  total: number;
  resting: boolean;
  ready: boolean;
  finished: boolean;
};

function sameStatus(a: CardStatus | undefined, b: CardStatus): boolean {
  return (
    !!a &&
    a.done === b.done &&
    a.total === b.total &&
    a.resting === b.resting &&
    a.ready === b.ready &&
    a.finished === b.finished
  );
}

/**
 * The shared-device group workout board: one card per person, all logged from
 * this screen. Each card owns its own session state; the board only provides
 * the shared clock and tracks who has finished. Landscape iPad (lg+) shows the
 * cards side by side; narrower screens show one person at a time behind a
 * tab bar — every card stays mounted, so switching keeps its state.
 */
export function GroupBoard({
  people,
  variants,
  catalog,
}: {
  people: BoardPerson[];
  variants: Variant[];
  catalog: ExerciseCatalog;
}) {
  // One clock for the whole board, keyed by the session ids so leaving and
  // coming back (or a Safari tab eviction) doesn't reset everyone's elapsed
  // time. Cleared when the last person finishes.
  const boardKey = people
    .map((p) => p.session.id)
    .sort()
    .join(",");
  const { now, elapsedMinutes, clear: clearClock } = useSessionClock(boardKey);
  useWakeLock();
  const [finishedIds, setFinishedIds] = useState<ReadonlySet<string>>(new Set());
  const [statuses, setStatuses] = useState<Record<string, CardStatus>>({});
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const reportStatus = useCallback((sessionId: string, status: CardStatus) => {
    setStatuses((prev) =>
      sameStatus(prev[sessionId], status) ? prev : { ...prev, [sessionId]: status },
    );
  }, []);
  const tabbed = people.length >= 2;
  const selected =
    selectedId ??
    people.find((p) => !p.finished && !statuses[p.session.id]?.finished)?.session.id ??
    people[0].session.id;

  const allDone = people.every((p) => p.finished || finishedIds.has(p.session.id));
  useEffect(() => {
    if (allDone) clearClock();
  }, [allDone, clearClock]);

  return (
    // Focus mode: hides the app nav while the board is up (globals.css).
    <div data-focus-mode>
      <div className="mb-3 flex items-center gap-3">
        <Link href="/" className={chipClass(false, "min-h-9 pointer-coarse:min-h-11 px-2.5 text-xs")}>
          <ArrowLeftIcon size={14} /> Exit
        </Link>
        <h1 className="text-lg font-bold tracking-tight">Group board</h1>
        <span className="font-mono text-xs text-muted">{elapsedMinutes} min</span>
        {allDone && (
          <Link
            href="/"
            className="ml-auto inline-flex min-h-11 items-center rounded-md px-2 text-sm font-semibold underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
          >
            Done — back to workout
          </Link>
        )}
      </div>

      {/* Portrait / phone: one person at a time. */}
      {tabbed && (
        <div role="tablist" aria-label="People" className="mb-3 flex gap-1.5 overflow-x-auto lg:hidden">
          {people.map((person) => {
            const id = person.session.id;
            const status = statuses[id];
            const isSelected = id === selected;
            const state = person.finished || status?.finished
              ? "done"
              : status?.ready
                ? "ready"
                : status?.resting
                  ? "rest"
                  : null;
            return (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={isSelected}
                onClick={() => setSelectedId(id)}
                className={`${chipClass(isSelected, "min-h-11 shrink-0 px-3 text-sm")} gap-2`}
              >
                <ColorDot color={person.color} />
                <span className="font-semibold">{person.clientName}</span>
                {status && (
                  <span className="font-mono text-xs opacity-80">
                    {status.done}/{status.total}
                  </span>
                )}
                {state && (
                  <span
                    className={`text-xs font-semibold ${
                      isSelected
                        ? ""
                        : state === "ready" || state === "done"
                          ? "text-success-text"
                          : "text-warning-text"
                    }`}
                  >
                    {state}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* Landscape (lg+): a duo gets two wide cards, three-plus goes three
          across with tighter gaps — the set rows switch to their two-line
          layout by card width. Default stretch alignment keeps cards in a
          row the same height. */}
      <div
        className={`grid grid-cols-1 ${
          people.length >= 3 ? "gap-2 lg:grid-cols-3" : people.length === 2 ? "gap-3 lg:grid-cols-2" : "gap-3"
        }`}
      >
        {people.map((person) => (
          // Inactive tabs stay mounted (hidden), keeping their card state.
          <div
            key={person.session.id}
            className={tabbed && person.session.id !== selected ? "hidden lg:block" : ""}
          >
            <GroupPersonCard
              person={person}
              variants={variants}
              catalog={catalog}
              now={now}
              boardElapsedMinutes={elapsedMinutes}
              boardSessionIds={people.map((p) => p.session.id).join(",")}
              onFinished={() =>
                setFinishedIds((prev) => new Set([...prev, person.session.id]))
              }
              onStatus={reportStatus}
              tight={people.length >= 3}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
