"use client";

import { useFormStatus } from "react-dom";
import { PlayIcon } from "@/components/icons";
import { Button } from "@/components/ui";
import { startSession } from "@/lib/actions/workout";

/**
 * "Want a finisher?" — after a workout, offer the care routines that match
 * what was just trained. Care work is easy to skip as a standalone session
 * and easy to say yes to while you're already warm.
 */
export function FinisherOffer({
  clientId,
  routines,
}: {
  clientId: string;
  routines: { id: string; name: string; notes: string }[];
}) {
  if (routines.length === 0) return null;
  return (
    <section className="mt-4 rounded-xl border border-accent/40 bg-accent-soft px-4 py-3">
      <h2 className="text-sm font-semibold">Add a finisher?</h2>
      <p className="text-xs text-muted">Care work for what you just trained, while you&apos;re warm.</p>
      <ul className="mt-2 space-y-2">
        {routines.map((routine) => (
          <li key={routine.id}>
            <form
              action={startSession.bind(null, clientId, routine.id, null)}
              className="flex flex-wrap items-center gap-x-3 gap-y-1"
            >
              <StartButton name={routine.name.replace(/^care\s*:\s*/i, "")} />
              {routine.notes && (
                <span className="min-w-0 flex-1 basis-60 text-xs text-muted">{routine.notes}</span>
              )}
            </form>
          </li>
        ))}
      </ul>
    </section>
  );
}

function StartButton({ name }: { name: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" disabled={pending}>
      <PlayIcon size={14} /> {pending ? "Starting…" : name}
    </Button>
  );
}
