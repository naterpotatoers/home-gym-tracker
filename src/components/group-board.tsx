"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { GroupPersonCard } from "@/components/group-person-card";
import type { Variant } from "@/lib/queries";
import type { RoutineExercise, Session, SetLog } from "@/lib/types";

export type BoardPerson = {
  session: Session;
  initialSets: SetLog[];
  prescriptions: RoutineExercise[];
  clientName: string;
  routineName: string;
};

/**
 * The shared-device group workout board: one card per person, all logged from
 * this screen. Each card owns its own session state; the board only provides
 * the shared clock and tracks who has finished.
 */
export function GroupBoard({
  people,
  variants,
}: {
  people: BoardPerson[];
  variants: Variant[];
}) {
  const [now, setNow] = useState(0);
  const [elapsedMinutes, setElapsedMinutes] = useState(0);
  const [finishedIds, setFinishedIds] = useState<ReadonlySet<string>>(new Set());

  useEffect(() => {
    const startedAt = Date.now();
    const timer = setInterval(() => {
      const t = Date.now();
      setNow(t);
      setElapsedMinutes(Math.floor((t - startedAt) / 60_000));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const allDone = finishedIds.size === people.length;

  return (
    <div>
      <div className="mb-4 flex items-baseline gap-3">
        <h1 className="text-xl font-bold tracking-tight">Group board</h1>
        <span className="font-mono text-xs opacity-60">{elapsedMinutes} min</span>
        {allDone && (
          <Link
            href="/workout"
            className="ml-auto text-sm font-semibold underline underline-offset-2"
          >
            Done — back to workout
          </Link>
        )}
      </div>

      {/* One card per person; on iPad landscape up to three side by side so
          people can be compared at a glance. Default stretch alignment keeps
          cards in a row the same height. */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
        {people.map((person) => (
          <GroupPersonCard
            key={person.session.id}
            person={person}
            variants={variants}
            now={now}
            boardElapsedMinutes={elapsedMinutes}
            onFinished={() =>
              setFinishedIds((prev) => new Set([...prev, person.session.id]))
            }
          />
        ))}
      </div>
    </div>
  );
}
