"use client";

import { useState } from "react";
import { EffortPicker } from "@/components/effort-picker";
import { CheckIcon } from "@/components/icons";
import { Button, Input } from "@/components/ui";
import type { SessionCondition } from "@/lib/types";

export type FinishPayload = {
  rpe: number | null;
  condition: SessionCondition | null;
  notes: string;
};

/**
 * The end-of-session effort + notes panel shared by the solo runner and the
 * group cards. Owns its own rpe/condition/notes state and hands the payload
 * to the caller on submit; any save error renders right here next to the
 * button, where the user is actually looking.
 */
export function FinishPanel({
  label,
  busy,
  error,
  onFinish,
  durationSlot,
}: {
  /** Button text, e.g. "Finish session" or "Finish Nate". */
  label: string;
  busy: boolean;
  error: string | null;
  onFinish: (payload: FinishPayload) => void;
  /** Optional extra control (the solo runner's minutes input). */
  durationSlot?: React.ReactNode;
}) {
  const [rpe, setRpe] = useState<number | null>(null);
  const [condition, setCondition] = useState<SessionCondition | null>(null);
  const [notes, setNotes] = useState("");

  return (
    <div className="space-y-3">
      <EffortPicker
        rpe={rpe}
        condition={condition}
        onChange={(patch) => {
          if (patch.rpe !== undefined) setRpe(patch.rpe);
          if (patch.condition !== undefined) setCondition(patch.condition);
        }}
      />
      <div className="flex flex-wrap items-center gap-2">
        {durationSlot}
        <Input
          type="text"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Notes"
          className="min-w-48 flex-1"
        />
        <Button
          variant="primary"
          onClick={() => onFinish({ rpe, condition, notes })}
          disabled={busy}
        >
          {busy ? "Saving…" : <><CheckIcon size={16} /> {label}</>}
        </Button>
        {error && (
          <span className="text-xs font-semibold text-danger-text">{error}</span>
        )}
      </div>
    </div>
  );
}
