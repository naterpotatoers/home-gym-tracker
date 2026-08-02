"use client";

import { IconButton, NumberInput, Select } from "@/components/ui";
import { bands } from "@/lib/data/equipment";
import { describePlates, formatPlates } from "@/lib/loading";
import { bandRolesFor } from "@/lib/queries";
import type { BandId, BandRole, MetricType, SetLog } from "@/lib/types";

/**
 * One set's editable row. Weight controls adapt to the set's modality: barbell
 * and dumbbell take a typed load (with a plate breakdown hint for barbell),
 * bodyweight edits added weight, bands pick a band.
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
  /** Tighter spacing + h-9 controls, for the group board's always-visible list. */
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
      className={`grid grid-cols-[auto_1fr] items-start gap-x-2 gap-y-1 rounded-lg text-sm ${
        dense ? "px-1 py-1" : "px-2 py-2"
      } ${
        set.completed ? "bg-success/10" : ""
      } ${set.isWarmup ? "opacity-70" : ""}`}
    >
      <span className="flex flex-col items-center gap-0.5 p-1.5">
        <input
          type="checkbox"
          checked={set.completed}
          onChange={(e) => onChange({ completed: e.target.checked })}
          className="size-6 accent-accent"
        />
        {/* Tap the set number to toggle warm-up — W replaces the number. */}
        <button
          type="button"
          onClick={() => onChange({ isWarmup: !set.isWarmup })}
          title="Toggle warm-up"
          aria-label={set.isWarmup ? "Warm-up set — tap for working set" : "Working set — tap for warm-up"}
          className={`cursor-pointer rounded px-2 py-1 font-mono text-xs ${
            set.isWarmup ? "font-semibold text-warning-text" : "text-muted"
          }`}
        >
          {set.isWarmup ? "W" : set.setNumber}
        </button>
      </span>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 pt-1">
        {/* Load control, by modality */}
        {(set.modalityId === "barbell" || set.modalityId === "dumbbell") && (
          <span className="flex items-center gap-1">
            <NumberInput
              size={controlSize}
              step={set.modalityId === "barbell" ? 5 : 2.5}
              value={set.weightLbs}
              onChange={(v) => onChange({ weightLbs: v })}
              className="w-20"
            />
            <span className="text-xs text-muted">
              lb{set.modalityId === "dumbbell" ? " ea" : ""}
            </span>
          </span>
        )}

        {set.modalityId === "machine" && (
          <span className="flex items-center gap-1">
            <NumberInput
              size={controlSize}
              step={5}
              value={set.weightLbs}
              onChange={(v) => onChange({ weightLbs: v })}
              className="w-20"
            />
            <span className="text-xs text-muted">lb</span>
          </span>
        )}

        {set.modalityId === "bodyweight" && (
          <span className="flex items-center gap-1">
            <span className="text-xs text-muted">BW +</span>
            <NumberInput
              size={controlSize}
              step={2.5}
              value={set.addedWeightLbs}
              placeholder="0"
              onChange={(v) => onChange({ addedWeightLbs: v })}
              className="w-20"
            />
            <span className="text-xs text-muted">lb</span>
          </span>
        )}

        {set.modalityId === "band" && (
          <span className="flex items-center gap-1">
            <Select
              size={controlSize}
              value={set.bandId ?? ""}
              onChange={(e) => onChange({ bandId: (e.target.value || null) as BandId | null })}
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
              >
                {roles.map((role) => (
                  <option key={role} value={role}>{role}</option>
                ))}
              </Select>
            )}
          </span>
        )}

        {/* Metric control */}
        {metricType === "time" || set.durationSeconds !== null ? (
          <span className="flex items-center gap-1">
            <NumberInput
              size={controlSize}
              step={5}
              value={set.durationSeconds}
              onChange={(v) => onChange({ durationSeconds: v })}
              className="w-20"
            />
            <span className="text-xs text-muted">sec</span>
          </span>
        ) : metricType === "distance" ? (
          <span className="flex items-center gap-1">
            <NumberInput
              size={controlSize}
              step={10}
              value={set.distanceFeet}
              onChange={(v) => onChange({ distanceFeet: v })}
              className="w-20"
            />
            <span className="text-xs text-muted">ft</span>
          </span>
        ) : (
          <span className="flex items-center gap-1">
            <IconButton
              size={controlSize}
              aria-label="Decrease reps"
              onClick={() => onChange({ reps: Math.max(0, (set.reps ?? 0) - 1) })}
            >
              −
            </IconButton>
            <NumberInput
              size={controlSize}
              value={set.reps}
              onChange={(v) => onChange({ reps: v })}
              className="w-16"
            />
            <IconButton
              size={controlSize}
              aria-label="Increase reps"
              onClick={() => onChange({ reps: (set.reps ?? 0) + 1 })}
            >
              +
            </IconButton>
            <span className="text-xs text-muted">
              reps{set.unilateralMode !== "bilateral" ? "/side" : ""}
            </span>
          </span>
        )}

        {/* RIR cycles –, 0…4 on tap — no keyboard, no label. */}
        <button
          type="button"
          onClick={() =>
            onChange({ rir: set.rir === null ? 0 : set.rir >= 4 ? null : set.rir + 1 })
          }
          aria-label={`Reps in reserve: ${set.rir ?? "not set"}, tap to change`}
          className={`cursor-pointer rounded-md border px-2 font-mono text-xs ${
            dense ? "h-9" : "h-11"
          } ${
            set.rir !== null
              ? "border-accent/40 bg-accent-soft text-accent-text"
              : "border-border-strong text-muted"
          }`}
        >
          RIR {set.rir ?? "–"}
        </button>

        <IconButton
          variant="ghost"
          size={controlSize}
          onClick={onRemove}
          className="ml-auto"
          aria-label="Remove set"
          title="Remove set"
        >
          ✕
        </IconButton>

        {plateHint && (
          <span className="w-full font-mono text-[10px] text-muted">
            {describePlates(plateHint)}
          </span>
        )}
      </div>
    </div>
  );
}
