"use client";

import { TrashIcon } from "@/components/icons";
import { Checkbox, IconButton, NumberInput, Select } from "@/components/ui";
import { bands } from "@/lib/data/equipment";
import { describePlates, formatPlates } from "@/lib/loading";
import { bandRolesFor } from "@/lib/queries";
import type { BandId, BandRole, MetricType, SetLog } from "@/lib/types";

/**
 * One set's editable row: a fixed two-line grid so every row is the same
 * height — line 1 is the load + metric inputs, line 2 is RIR + delete.
 * Weight fits 4 characters, reps 3; nothing wraps. Warm-up toggles by
 * tapping the set number (W). Load controls adapt to the set's modality.
 */
export function SetRow({
  set,
  metricType,
  onChange,
  onRemove,
  dense = false,
}: {
  set: SetLog;
  metricType: MetricType;
  onChange: (changes: Partial<SetLog>) => void;
  onRemove: () => void;
  /** Tighter spacing + h-9 controls, for the group board's card list. */
  dense?: boolean;
}) {
  const roles = set.modalityId === "band" ? bandRolesFor(set.exerciseId, set.modalityId) : [];
  const controlSize = dense ? ("sm" as const) : ("md" as const);
  const plateHint =
    set.modalityId === "barbell" && set.weightLbs !== null
      ? formatPlates(set.weightLbs)
      : null;

  return (
    <div
      className={`grid grid-cols-[auto_1fr] gap-x-2 rounded-lg py-1.5 ${
        dense ? "px-1" : "px-1 sm:px-2"
      } ${set.completed ? "bg-success/10" : ""} ${set.isWarmup ? "opacity-70" : ""}`}
    >
      <span className="flex flex-col items-center">
        {/* The checkbox is the primary control of the whole row — the label
            gives it a full-size hit area around the small visual box. */}
        <label
          className={`flex cursor-pointer items-center justify-center ${
            dense ? "size-9" : "size-11"
          }`}
        >
          <Checkbox
            checked={set.completed}
            onChange={(e) => onChange({ completed: e.target.checked })}
            aria-label="Set completed"
          />
        </label>
        {/* Tap the set number to toggle warm-up — W replaces the number. */}
        <button
          type="button"
          onClick={() => onChange({ isWarmup: !set.isWarmup })}
          title="Toggle warm-up"
          aria-label={set.isWarmup ? "Warm-up set — tap for working set" : "Working set — tap for warm-up"}
          className={`flex min-h-9 min-w-9 cursor-pointer items-center justify-center rounded font-mono text-xs ${
            set.isWarmup ? "font-semibold text-warning-text" : "text-muted"
          }`}
        >
          {set.isWarmup ? "W" : set.setNumber}
        </button>
      </span>

      <div className="min-w-0">
        {/* Line 1: load + metric, never wraps */}
        <div className="flex flex-nowrap items-center gap-1.5 overflow-x-auto text-sm">
          {(set.modalityId === "barbell" || set.modalityId === "dumbbell") && (
            <>
              <NumberInput
                size={controlSize}
                step={set.modalityId === "barbell" ? 5 : 2.5}
                value={set.weightLbs}
                onChange={(v) => onChange({ weightLbs: v })}
                className={dense ? "w-16" : "w-20"}
              />
              <span className="shrink-0 text-xs text-muted">
                lb{set.modalityId === "dumbbell" ? " ea" : ""}
              </span>
            </>
          )}

          {set.modalityId === "machine" && (
            <>
              <NumberInput
                size={controlSize}
                step={5}
                value={set.weightLbs}
                onChange={(v) => onChange({ weightLbs: v })}
                className={dense ? "w-16" : "w-20"}
              />
              <span className="shrink-0 text-xs text-muted">lb</span>
            </>
          )}

          {set.modalityId === "bodyweight" && (
            <>
              <span className="shrink-0 text-xs text-muted">BW +</span>
              <NumberInput
                size={controlSize}
                step={2.5}
                value={set.addedWeightLbs}
                placeholder="0"
                onChange={(v) => onChange({ addedWeightLbs: v })}
                className={dense ? "w-16" : "w-20"}
              />
              <span className="shrink-0 text-xs text-muted">lb</span>
            </>
          )}

          {set.modalityId === "band" && (
            <>
              <Select
                size={controlSize}
                value={set.bandId ?? ""}
                onChange={(e) => onChange({ bandId: (e.target.value || null) as BandId | null })}
                className="min-w-0 max-w-40"
              >
                <option value="">band…</option>
                {bands.map((band) => (
                  <option key={band.id} value={band.id}>
                    {band.family === "monster"
                      ? `${band.label} (${band.minLbs}-${band.maxLbs})`
                      : `${band.label} ${band.sizeInches}"`}
                  </option>
                ))}
              </Select>
              {roles.length > 1 && (
                <Select
                  size={controlSize}
                  value={set.bandRole ?? ""}
                  onChange={(e) => onChange({ bandRole: (e.target.value || null) as BandRole | null })}
                  className="min-w-0"
                >
                  {roles.map((role) => (
                    <option key={role} value={role}>{role}</option>
                  ))}
                </Select>
              )}
            </>
          )}

          {/* Metric */}
          {metricType === "time" || set.durationSeconds !== null ? (
            <>
              <NumberInput
                size={controlSize}
                step={5}
                value={set.durationSeconds}
                onChange={(v) => onChange({ durationSeconds: v })}
                className="w-16"
              />
              <span className="shrink-0 text-xs text-muted">sec</span>
            </>
          ) : metricType === "distance" ? (
            <>
              <NumberInput
                size={controlSize}
                step={10}
                value={set.distanceFeet}
                onChange={(v) => onChange({ distanceFeet: v })}
                className="w-16"
              />
              <span className="shrink-0 text-xs text-muted">ft</span>
            </>
          ) : (
            <>
              {/* Steppers are the iPad nudge affordance; phones don't have the
                  width for them — typing opens the decimal keypad instead.
                  `sm:contents` keeps the flex layout identical when shown. */}
              <span className="hidden sm:contents">
                <IconButton
                  size="sm"
                  aria-label="Decrease reps"
                  onClick={() => onChange({ reps: Math.max(0, (set.reps ?? 0) - 1) })}
                >
                  −
                </IconButton>
              </span>
              <NumberInput
                size={controlSize}
                value={set.reps}
                onChange={(v) => onChange({ reps: v })}
                className={dense ? "w-14" : "w-16"}
              />
              <span className="hidden sm:contents">
                <IconButton
                  size="sm"
                  aria-label="Increase reps"
                  onClick={() => onChange({ reps: (set.reps ?? 0) + 1 })}
                >
                  +
                </IconButton>
              </span>
              <span className="shrink-0 text-xs text-muted">
                reps{set.unilateralMode !== "bilateral" ? "/side" : ""}
              </span>
            </>
          )}
        </div>

        {/* Line 2: RIR + delete — same slots on every row */}
        <div className="mt-1 flex items-center">
          <button
            type="button"
            onClick={() =>
              onChange({ rir: set.rir === null ? 0 : set.rir >= 4 ? null : set.rir + 1 })
            }
            aria-label={`Reps in reserve: ${set.rir ?? "not set"}, tap to change`}
            className={`${dense ? "min-h-9" : "min-h-11"} cursor-pointer rounded-md border px-3 font-mono text-xs ${
              set.rir !== null
                ? "border-accent/40 bg-accent-soft text-accent-text"
                : "border-border-strong text-muted"
            }`}
          >
            RIR {set.rir ?? "–"}
          </button>
          <IconButton
            variant="ghost"
            size="sm"
            onClick={onRemove}
            className="ml-auto shrink-0"
            aria-label="Delete set"
            title="Delete set"
          >
            <TrashIcon />
          </IconButton>
        </div>

        {plateHint && (
          <div className="mt-0.5 font-mono text-[10px] text-muted">
            {describePlates(plateHint)}
          </div>
        )}
      </div>
    </div>
  );
}
