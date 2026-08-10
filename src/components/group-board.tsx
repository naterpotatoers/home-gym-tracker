"use client";

import Link from "next/link";
import { useState } from "react";
import { GroupPersonCard } from "@/components/group-person-card";
import { useSessionClock } from "@/components/use-session-clock";
import { useWakeLock } from "@/components/use-wake-lock";
import type { ExerciseCatalog } from "@/lib/exercise-catalog";
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
};

/**
 * The shared-device group workout board: one card per person, all logged from
 * this screen. Each card owns its own session state; the board only provides
 * the shared clock and tracks who has finished.
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

  const allDone = finishedIds.size === people.length;

  return (
    <div>
      <div className="mb-4 flex items-baseline gap-3">
        <h1 className="text-xl font-bold tracking-tight">Group board</h1>
        <span className="font-mono text-xs text-muted">{elapsedMinutes} min</span>
        {allDone && (
          <Link
            href="/workout"
            className="ml-auto text-sm font-semibold underline underline-offset-2"
          >
            Done — back to workout
          </Link>
        )}
      </div>

      {/* One card per person, columns matched to the head count: a duo gets
          two wide cards even on iPad landscape, three-plus goes to three
          across. Default stretch alignment keeps cards in a row the same
          height. */}
      <div
        className={`grid grid-cols-1 gap-3 ${people.length >= 2 ? "md:grid-cols-2" : ""} ${
          people.length >= 3 ? "lg:grid-cols-3" : ""
        }`}
      >
        {people.map((person) => (
          <GroupPersonCard
            key={person.session.id}
            person={person}
            variants={variants}
            catalog={catalog}
            now={now}
            boardElapsedMinutes={elapsedMinutes}
            onFinished={() => {
              if (finishedIds.size + 1 >= people.length) clearClock();
              setFinishedIds((prev) => new Set([...prev, person.session.id]));
            }}
          />
        ))}
      </div>
    </div>
  );
}
