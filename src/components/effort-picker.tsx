"use client";

import type { SessionCondition } from "@/lib/types";
import { toggleChipClass } from "@/components/ui";

const CONDITIONS: SessionCondition[] = ["rough", "tired", "normal", "good", "great"];
const RPE_VALUES = Array.from({ length: 10 }, (_, i) => i + 1);

/**
 * End-of-workout check-in: session RPE (how hard) and condition (how the body
 * felt). Both optional, one tap each; tapping the selected value clears it.
 */
export function EffortPicker({
  rpe,
  condition,
  onChange,
}: {
  rpe: number | null;
  condition: SessionCondition | null;
  onChange: (patch: { rpe?: number | null; condition?: SessionCondition | null }) => void;
}) {
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-1">
        <span className="mr-1 w-14 text-xs uppercase tracking-wide text-muted">
          Effort
        </span>
        {RPE_VALUES.map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => onChange({ rpe: rpe === value ? null : value })}
            aria-pressed={rpe === value}
            className={toggleChipClass(rpe === value, "size-11 rounded-md font-mono text-sm")}
          >
            {value}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-1">
        <span className="mr-1 w-14 text-xs uppercase tracking-wide text-muted">
          Felt
        </span>
        {CONDITIONS.map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => onChange({ condition: condition === value ? null : value })}
            aria-pressed={condition === value}
            className={toggleChipClass(condition === value)}
          >
            {value}
          </button>
        ))}
      </div>
    </div>
  );
}
