"use client";

import { useMemo, useState } from "react";
import { Select } from "@/components/ui";
import type { FinisherOption } from "@/lib/care";
import type { RoutineExercise } from "@/lib/types";

const PICK_EXERCISE = "__exercise";

/**
 * "Continue your workout?" — the first question of the end-of-session
 * check-in. Picking a finisher appends its exercises to THIS session (same
 * card, same board, one review at the end); "Pick an exercise…" opens the
 * exercise picker. The select resets after every pick, so it always reads
 * "No — wrap up" until asked again.
 */
export function ContinuePrompt({
  options,
  disabled = false,
  pending = false,
  onRoutine,
  onExercise,
}: {
  /** Finishers not yet added in this view, suggested ones first. */
  options: readonly FinisherOption[];
  disabled?: boolean;
  /** A finisher is being appended (one load lookup per exercise). */
  pending?: boolean;
  onRoutine: (option: FinisherOption) => void;
  onExercise: () => void;
}) {
  const suggested = options.filter((o) => o.suggested);
  const rest = options.filter((o) => !o.suggested);

  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm font-semibold">
        Continue your workout?
        {pending && <span className="ml-2 font-normal text-muted">Adding…</span>}
      </span>
      <Select
        value=""
        disabled={disabled || pending}
        onChange={(e) => {
          const value = e.target.value;
          if (value === PICK_EXERCISE) onExercise();
          else {
            const option = options.find((o) => o.id === value);
            if (option) onRoutine(option);
          }
        }}
        className="w-full sm:max-w-sm"
      >
        <option value="">No — wrap up</option>
        {suggested.length > 0 && (
          <optgroup label="Suggested finishers">
            {suggested.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </optgroup>
        )}
        {rest.length > 0 && (
          <optgroup label="Care & mobility">
            {rest.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </optgroup>
        )}
        <optgroup label="Something else">
          <option value={PICK_EXERCISE}>Pick an exercise…</option>
        </optgroup>
      </Select>
    </label>
  );
}

/**
 * Finishers added in this view: their prescriptions join the session's own
 * (rx line + rest for the appended blocks) and they drop out of the prompt.
 * Superset labels are namespaced per routine so a finisher's "A" never pairs
 * with the main routine's "A". Lives only in this view — after a reload the
 * appended blocks fall back to default rest.
 */
export function useFinisherAddOns(
  finishers: readonly FinisherOption[],
  prescriptions: readonly RoutineExercise[],
) {
  const [added, setAdded] = useState<FinisherOption[]>([]);
  const allPrescriptions = useMemo(
    () => [
      ...prescriptions,
      ...added.flatMap((option) =>
        option.prescriptions.map((rx) => ({
          ...rx,
          supersetGroup: rx.supersetGroup ? `${option.id}:${rx.supersetGroup}` : null,
        })),
      ),
    ],
    [prescriptions, added],
  );
  const remaining = useMemo(
    () => finishers.filter((f) => !added.some((a) => a.id === f.id)),
    [finishers, added],
  );
  return {
    allPrescriptions,
    remaining,
    markAdded: (option: FinisherOption) => setAdded((prev) => [...prev, option]),
  };
}
