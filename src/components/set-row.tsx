"use client";

import { IconButton, NumberInput, Select } from "@/components/ui";
import { bands, dumbbells } from "@/lib/data/equipment";
import { describePlates, formatPlates, loadableWeights } from "@/lib/loading";
import { bandRolesFor } from "@/lib/queries";
import type { BandId, BandRole, MetricType, SetLog } from "@/lib/types";

const BARBELL_LOADS = loadableWeights("ohio_bar");
const DUMBBELL_LOADS = dumbbells.map((d) => d.weightLbs);

/** Step within a fixed ladder of buildable loads — the stepper can only land
 *  on weights the equipment can actually produce. */
function stepIn(ladder: readonly number[], current: number | null, direction: -1 | 1): number {
  if (current === null) return ladder[direction === 1 ? 0 : ladder.length - 1];
  const candidates =
    direction === 1
      ? ladder.filter((w) => w > current)
      : [...ladder].reverse().filter((w) => w < current);
  return candidates[0] ?? current;
}

/**
 * One set's editable row. Weight controls adapt to the set's modality: barbell
 * steps through plate-buildable loads (with a plate breakdown hint), dumbbells
 * through the owned pairs, bodyweight edits added weight, bands pick a band.
 */
export function SetRow({
  set,
  metricType,
  onChange,
  onRemove,
}: {
  set: SetLog;
  metricType: MetricType;
  onChange: (changes: Partial<SetLog>) => void;
  onRemove: () => void;
}) {
  const roles = set.modalityId === "band" ? bandRolesFor(set.exerciseId, set.modalityId) : [];
  const plateHint =
    set.modalityId === "barbell" && set.weightLbs !== null
      ? formatPlates(set.weightLbs)
      : null;

  return (
    <div
      className={`grid grid-cols-[auto_1fr] items-start gap-x-2 gap-y-1 rounded-lg px-2 py-2 text-sm ${
        set.completed ? "bg-success/10" : ""
      } ${set.isWarmup ? "opacity-70" : ""}`}
    >
      <label className="flex flex-col items-center gap-0.5 p-1.5">
        <input
          type="checkbox"
          checked={set.completed}
          onChange={(e) => onChange({ completed: e.target.checked })}
          className="size-6 accent-accent"
        />
        <span className="font-mono text-xs text-muted">{set.setNumber}</span>
      </label>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 pt-1">
        {/* Load control, by modality */}
        {(set.modalityId === "barbell" || set.modalityId === "dumbbell") && (
          <span className="flex items-center gap-1">
            <IconButton
              aria-label="Decrease weight"
              onClick={() =>
                onChange({
                  weightLbs: stepIn(
                    set.modalityId === "barbell" ? BARBELL_LOADS : DUMBBELL_LOADS,
                    set.weightLbs,
                    -1,
                  ),
                })
              }
            >
              −
            </IconButton>
            <NumberInput
              value={set.weightLbs}
              onChange={(v) => onChange({ weightLbs: v })}
              className="w-20"
            />
            <IconButton
              aria-label="Increase weight"
              onClick={() =>
                onChange({
                  weightLbs: stepIn(
                    set.modalityId === "barbell" ? BARBELL_LOADS : DUMBBELL_LOADS,
                    set.weightLbs,
                    1,
                  ),
                })
              }
            >
              +
            </IconButton>
            <span className="text-xs text-muted">
              lb{set.modalityId === "dumbbell" ? " ea" : ""}
            </span>
          </span>
        )}

        {set.modalityId === "machine" && (
          <span className="flex items-center gap-1">
            <NumberInput
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
              aria-label="Decrease reps"
              onClick={() => onChange({ reps: Math.max(0, (set.reps ?? 0) - 1) })}
            >
              −
            </IconButton>
            <NumberInput
              value={set.reps}
              onChange={(v) => onChange({ reps: v })}
              className="w-16"
            />
            <IconButton
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

        <span className="flex items-center gap-1">
          <span className="text-xs text-muted">RIR</span>
          <NumberInput
            min={0}
            value={set.rir}
            placeholder="—"
            onChange={(v) => onChange({ rir: v })}
            className="w-14"
          />
        </span>

        <label className="flex items-center gap-1.5 p-1.5 text-xs text-muted">
          <input
            type="checkbox"
            checked={set.isWarmup}
            onChange={(e) => onChange({ isWarmup: e.target.checked })}
            className="size-5 accent-accent"
          />
          warmup
        </label>

        <IconButton
          variant="ghost"
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
