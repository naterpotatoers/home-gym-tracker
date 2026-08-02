"use client";

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
      className={`flex flex-wrap items-center gap-x-3 gap-y-1 rounded px-2 py-1.5 text-sm ${
        set.completed ? "bg-current/5" : ""
      } ${set.isWarmup ? "opacity-70" : ""}`}
    >
      <label className="flex items-center gap-1.5">
        <input
          type="checkbox"
          checked={set.completed}
          onChange={(e) => onChange({ completed: e.target.checked })}
          className="size-4"
        />
        <span className="w-5 font-mono text-xs opacity-50">{set.setNumber}</span>
      </label>

      {/* Load control, by modality */}
      {(set.modalityId === "barbell" || set.modalityId === "dumbbell") && (
        <span className="flex items-center gap-1">
          <StepButton
            label="−"
            onClick={() =>
              onChange({
                weightLbs: stepIn(
                  set.modalityId === "barbell" ? BARBELL_LOADS : DUMBBELL_LOADS,
                  set.weightLbs,
                  -1,
                ),
              })
            }
          />
          <input
            type="number"
            value={set.weightLbs ?? ""}
            onChange={(e) =>
              onChange({ weightLbs: e.target.value === "" ? null : Number(e.target.value) })
            }
            className="w-16 rounded border border-current/20 bg-transparent px-1 py-0.5 text-right font-mono text-xs"
          />
          <StepButton
            label="+"
            onClick={() =>
              onChange({
                weightLbs: stepIn(
                  set.modalityId === "barbell" ? BARBELL_LOADS : DUMBBELL_LOADS,
                  set.weightLbs,
                  1,
                ),
              })
            }
          />
          <span className="text-xs opacity-50">
            lb{set.modalityId === "dumbbell" ? " ea" : ""}
          </span>
        </span>
      )}

      {set.modalityId === "machine" && (
        <span className="flex items-center gap-1">
          <input
            type="number"
            step={5}
            value={set.weightLbs ?? ""}
            onChange={(e) =>
              onChange({ weightLbs: e.target.value === "" ? null : Number(e.target.value) })
            }
            className="w-16 rounded border border-current/20 bg-transparent px-1 py-0.5 text-right font-mono text-xs"
          />
          <span className="text-xs opacity-50">lb</span>
        </span>
      )}

      {set.modalityId === "bodyweight" && (
        <span className="flex items-center gap-1">
          <span className="text-xs opacity-50">BW +</span>
          <input
            type="number"
            step={2.5}
            value={set.addedWeightLbs ?? ""}
            placeholder="0"
            onChange={(e) =>
              onChange({
                addedWeightLbs: e.target.value === "" ? null : Number(e.target.value),
              })
            }
            className="w-14 rounded border border-current/20 bg-transparent px-1 py-0.5 text-right font-mono text-xs"
          />
          <span className="text-xs opacity-50">lb</span>
        </span>
      )}

      {set.modalityId === "band" && (
        <span className="flex items-center gap-1">
          <select
            value={set.bandId ?? ""}
            onChange={(e) => onChange({ bandId: (e.target.value || null) as BandId | null })}
            className="rounded border border-current/20 bg-transparent px-1 py-0.5 text-xs"
          >
            <option value="">band…</option>
            {bands.map((band) => (
              <option key={band.id} value={band.id}>
                {band.family === "monster"
                  ? `${band.label} (${band.minLbs}-${band.maxLbs})`
                  : `${band.label} ${band.sizeInches}"`}
              </option>
            ))}
          </select>
          {roles.length > 1 && (
            <select
              value={set.bandRole ?? ""}
              onChange={(e) => onChange({ bandRole: (e.target.value || null) as BandRole | null })}
              className="rounded border border-current/20 bg-transparent px-1 py-0.5 text-xs"
            >
              {roles.map((role) => (
                <option key={role} value={role}>{role}</option>
              ))}
            </select>
          )}
        </span>
      )}

      {/* Metric control */}
      {metricType === "time" || set.durationSeconds !== null ? (
        <span className="flex items-center gap-1">
          <input
            type="number"
            step={5}
            value={set.durationSeconds ?? ""}
            onChange={(e) =>
              onChange({
                durationSeconds: e.target.value === "" ? null : Number(e.target.value),
              })
            }
            className="w-14 rounded border border-current/20 bg-transparent px-1 py-0.5 text-right font-mono text-xs"
          />
          <span className="text-xs opacity-50">sec</span>
        </span>
      ) : metricType === "distance" ? (
        <span className="flex items-center gap-1">
          <input
            type="number"
            step={10}
            value={set.distanceFeet ?? ""}
            onChange={(e) =>
              onChange({ distanceFeet: e.target.value === "" ? null : Number(e.target.value) })
            }
            className="w-14 rounded border border-current/20 bg-transparent px-1 py-0.5 text-right font-mono text-xs"
          />
          <span className="text-xs opacity-50">ft</span>
        </span>
      ) : (
        <span className="flex items-center gap-1">
          <StepButton
            label="−"
            onClick={() => onChange({ reps: Math.max(0, (set.reps ?? 0) - 1) })}
          />
          <input
            type="number"
            value={set.reps ?? ""}
            onChange={(e) =>
              onChange({ reps: e.target.value === "" ? null : Number(e.target.value) })
            }
            className="w-12 rounded border border-current/20 bg-transparent px-1 py-0.5 text-right font-mono text-xs"
          />
          <StepButton label="+" onClick={() => onChange({ reps: (set.reps ?? 0) + 1 })} />
          <span className="text-xs opacity-50">
            reps{set.unilateralMode !== "bilateral" ? "/side" : ""}
          </span>
        </span>
      )}

      <span className="flex items-center gap-1">
        <span className="text-xs opacity-50">RIR</span>
        <input
          type="number"
          min={0}
          value={set.rir ?? ""}
          placeholder="—"
          onChange={(e) => onChange({ rir: e.target.value === "" ? null : Number(e.target.value) })}
          className="w-10 rounded border border-current/20 bg-transparent px-1 py-0.5 text-right font-mono text-xs"
        />
      </span>

      <label className="flex items-center gap-1 text-xs opacity-60">
        <input
          type="checkbox"
          checked={set.isWarmup}
          onChange={(e) => onChange({ isWarmup: e.target.checked })}
          className="size-3"
        />
        warmup
      </label>

      <button
        type="button"
        onClick={onRemove}
        className="ml-auto text-xs opacity-40 hover:opacity-100"
        title="Remove set"
      >
        ✕
      </button>

      {plateHint && (
        <span className="w-full pl-11 font-mono text-[10px] opacity-40">
          {describePlates(plateHint)}
        </span>
      )}
    </div>
  );
}

function StepButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="size-6 rounded border border-current/20 text-xs hover:bg-current/10"
    >
      {label}
    </button>
  );
}
