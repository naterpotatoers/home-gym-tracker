"use client";

import type { SessionCondition } from "@/lib/types";

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
        <span className="mr-1 w-14 text-xs uppercase tracking-wide opacity-60">
          Effort
        </span>
        {RPE_VALUES.map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => onChange({ rpe: rpe === value ? null : value })}
            className={`size-8 rounded border font-mono text-xs ${
              rpe === value
                ? "border-current/40 bg-current/20 font-semibold"
                : "border-current/20 opacity-60 hover:opacity-100"
            }`}
          >
            {value}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-1">
        <span className="mr-1 w-14 text-xs uppercase tracking-wide opacity-60">
          Felt
        </span>
        {CONDITIONS.map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => onChange({ condition: condition === value ? null : value })}
            className={`rounded border px-2.5 py-1.5 text-xs ${
              condition === value
                ? "border-current/40 bg-current/20 font-semibold"
                : "border-current/20 opacity-60 hover:opacity-100"
            }`}
          >
            {value}
          </button>
        ))}
      </div>
    </div>
  );
}
