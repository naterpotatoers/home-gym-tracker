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
        <EffortScale value={rpe} onChange={(value) => onChange({ rpe: value })} label="Session effort" />
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

/**
 * The 1–10 effort chips — the session check-in's RPE row and a bike piece's
 * "how hard did it feel". One tap picks, tapping the picked one clears. Each
 * chip is 44px; `grid` lays them out 5 across (two rows) for narrow cards.
 */
export function EffortScale({
  value,
  onChange,
  label,
  grid = false,
}: {
  value: number | null;
  onChange: (value: number | null) => void;
  /** Accessible group name — "Session effort", "Piece effort". */
  label: string;
  grid?: boolean;
}) {
  return (
    <div role="group" aria-label={label} className={grid ? "grid w-fit grid-cols-5 gap-1" : "flex flex-wrap gap-1"}>
      {RPE_VALUES.map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => onChange(value === n ? null : n)}
          aria-pressed={value === n}
          aria-label={`${label} ${n} of 10`}
          className={toggleChipClass(value === n, "size-11 rounded-md font-mono text-sm")}
        >
          {n}
        </button>
      ))}
    </div>
  );
}
