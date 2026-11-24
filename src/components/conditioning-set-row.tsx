"use client";

import { useState } from "react";
import { EffortScale } from "@/components/effort-picker";
import { OverflowMenu } from "@/components/overflow-menu";
import { TrashIcon } from "@/components/icons";
import { NumberInput, Select, StepperInput } from "@/components/ui";
import {
  CONSOLE_PRESETS,
  conditioningOf,
  DEFAULT_STEADY_SECONDS,
  effortLabel,
  feetToMiles,
  milesToFeet,
  parseIntervalScheme,
  pieceLabel,
  pieceSeconds,
  readoutLabel,
  targetLabel,
  targetResult,
  TARGET_RESULT_LABELS,
  type TargetResult,
} from "@/lib/conditioning";
import { mmss } from "@/lib/periods";
import { conditioningSetLabel } from "@/lib/session-labels";
import type { ConditioningLog, SetLog } from "@/lib/types";
import { WARMUP_EFFORT } from "@/lib/warmup";

const STEADY = "steady";

/**
 * One bike piece (Echo Bike) — the conditioning counterpart of SetRow, same
 * contract. Compact: the piece and either the person's target or, once
 * entered, the console's readout. Active: the target in big type (adjustable
 * for today — their next piece starts from it), the console numbers to copy
 * off the frozen screen after STOP, and LOG. Editing a logged piece un-logs
 * it, like SetRow.
 */
export function ConditioningSetRow({
  set,
  onChange,
  onLog,
  onRemove,
  active = false,
  onActivate,
  logDisabled = false,
  dense = false,
}: {
  set: SetLog;
  onChange: (changes: Partial<SetLog>) => void;
  onLog: (opts: { relog: boolean }) => void;
  onRemove: () => void;
  active?: boolean;
  onActivate?: () => void;
  logDisabled?: boolean;
  dense?: boolean;
}) {
  const [relog, setRelog] = useState(false);
  const size = dense ? ("sm" as const) : ("md" as const);
  const log = conditioningOf(set);
  const result = targetResult(log);
  const target = targetLabel(log);
  // The block header already names the piece; the row leads with the numbers.
  const readout = readoutLabel(log, set.distanceFeet);
  const effort = effortLabel(log);
  const compactText =
    readout !== null
      ? [readout, effort].filter((p) => p !== null).join(" · ")
      : target
        ? `target ${target}`
        : pieceLabel(log.intervalScheme, set.durationSeconds);

  function edit(changes: Partial<SetLog>) {
    if (set.completed) {
      setRelog(true);
      onChange({ ...changes, completed: false });
    } else {
      onChange(changes);
    }
  }
  const editLog = (changes: Partial<ConditioningLog>) =>
    edit({ conditioning: { ...log, ...changes } });

  function setPiece(value: string) {
    const intervalScheme = value === STEADY ? null : value;
    const steadySeconds = parseIntervalScheme(log.intervalScheme)
      ? DEFAULT_STEADY_SECONDS
      : (set.durationSeconds ?? DEFAULT_STEADY_SECONDS);
    edit({
      conditioning: { ...log, intervalScheme },
      durationSeconds: pieceSeconds({ conditioning: { ...log, intervalScheme }, durationSeconds: steadySeconds }),
    });
  }

  const menu = (
    <OverflowMenu
      label={`Piece ${set.setNumber} actions`}
      items={[
        ...(set.completed
          ? [{ label: "Mark not done", onSelect: () => onChange({ completed: false }) }]
          : []),
        { label: "Delete piece", icon: <TrashIcon size={16} />, onSelect: onRemove, danger: true },
      ]}
    />
  );

  if (!active) {
    return (
      <div
        className={`flex min-h-11 items-center gap-1.5 rounded-lg px-1 ${set.completed ? "bg-success/10" : ""}`}
      >
        <span
          className={`w-6 shrink-0 text-center font-mono text-xs ${
            set.completed ? "font-semibold text-success-text" : "text-muted"
          }`}
        >
          {set.completed ? (
            <>
              ✓<span className="sr-only"> logged</span>
            </>
          ) : (
            set.setNumber
          )}
        </span>
        <button
          type="button"
          onClick={onActivate}
          aria-label={`Edit piece ${set.setNumber}: ${conditioningSetLabel(set)}`}
          // Wraps rather than truncating: in a 3-across board card the readout
          // is the part that matters.
          className="flex min-h-9 min-w-0 flex-1 cursor-pointer flex-wrap items-center gap-x-3 gap-y-0.5 rounded-md px-1 py-1 text-left font-mono text-sm hover:bg-current/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 pointer-coarse:min-h-11"
        >
          <span className="min-w-0">{compactText}</span>
          {result && <ResultLabel result={result} />}
        </button>
        {menu}
      </div>
    );
  }

  const scheme = log.intervalScheme;
  const custom = scheme !== null && !CONSOLE_PRESETS.some((p) => p.scheme === scheme);

  return (
    <div className="space-y-2 rounded-lg border-2 border-accent/60 bg-accent-soft px-2 py-2">
      {/* The piece + the person's target, big — what you call out on the floor */}
      <div className="flex flex-wrap items-end gap-x-3 gap-y-2">
        <Labeled caption="Piece">
          <Select size={size} value={scheme ?? STEADY} onChange={(e) => setPiece(e.target.value)} aria-label="Piece">
            {CONSOLE_PRESETS.map((p) => (
              <option key={p.scheme} value={p.scheme}>
                {p.label}
              </option>
            ))}
            {custom && <option value={scheme}>{scheme.replace("x", " × ")}</option>}
            <option value={STEADY}>Steady</option>
          </Select>
        </Labeled>
        {scheme === null && (
          <Labeled caption="min">
            <StepperInput
              size={size}
              value={set.durationSeconds === null ? null : Math.round(set.durationSeconds / 60)}
              onChange={(v) => edit({ durationSeconds: v ? v * 60 : null })}
              min={1}
              max={60}
              label="minutes"
              className="w-12"
            />
          </Labeled>
        )}
        <Labeled caption="target W">
          <StepperInput
            size={size}
            step={5}
            value={log.targetWatts}
            onChange={(v) => editLog({ targetWatts: v || null })}
            max={2000}
            label="target watts"
            className="w-16 text-lg font-bold"
          />
        </Labeled>
        <Labeled caption="target rpm">
          <StepperInput
            size={size}
            value={log.targetRpm}
            onChange={(v) => editLog({ targetRpm: v || null })}
            max={250}
            label="target rpm"
            className="w-14 text-lg font-bold"
          />
        </Labeled>
      </div>
      {!target && (
        <p className="text-xs text-muted">
          {set.isWarmup
            ? `Warm-up: easy pace, ${WARMUP_EFFORT} — no target needed.`
            : "No target yet — set watts or RPM (or both)."}
        </p>
      )}

      {/* The console's frozen screen after STOP, laid out like the Echo's:
          WATTS (avg, then max — the AVG/MAX toggle) and CADENCE on top;
          DISTANCE · TIME · CALORIES underneath. Speed is skipped (it's
          derived from watts). */}
      <div className="grid grid-cols-3 gap-2" role="group" aria-label="Console readout">
        <Readout caption="avg watts" value={log.avgWatts} onChange={(v) => editLog({ avgWatts: whole(v) })} size={size} />
        <Readout caption="max watts" value={log.maxWatts} onChange={(v) => editLog({ maxWatts: whole(v) })} size={size} />
        <Readout caption="avg cadence" value={log.avgRpm} onChange={(v) => editLog({ avgRpm: whole(v) })} size={size} />
        <Readout
          caption="distance mi"
          step={0.01}
          value={set.distanceFeet === null ? null : Number(feetToMiles(set.distanceFeet).toFixed(2))}
          onChange={(v) => edit({ distanceFeet: v === null ? null : milesToFeet(v) })}
          size={size}
        />
        {/* Time is the piece's length — shown so the grid matches the
            console, not typed (change the piece above). */}
        <div className="flex min-w-0 flex-col">
          <span
            className={`flex items-center justify-center rounded-md border border-dashed border-border font-mono text-muted ${
              size === "sm" ? "min-h-9 pointer-coarse:min-h-11 text-sm" : "min-h-11 text-base"
            }`}
          >
            {set.durationSeconds !== null ? mmss(set.durationSeconds) : "—"}
          </span>
          <span className="mt-0.5 text-center text-[10px] leading-none text-muted">time</span>
        </div>
        <Readout caption="calories" value={log.calories} onChange={(v) => editLog({ calories: whole(v) })} size={size} />
      </div>

      {/* How hard it felt — a self-report, not a console number, so picking
          one doesn't un-log the piece. */}
      <div className="space-y-1">
        <p className="text-xs text-muted">How hard did it feel? (1 easy – 10 all-out)</p>
        <EffortScale
          value={log.effort ?? null}
          onChange={(value) => onChange({ conditioning: { ...log, effort: value } })}
          label="Piece effort"
          grid={dense}
        />
      </div>

      <div className="flex items-center justify-end gap-2">
        {result && <ResultLabel result={result} />}
        {set.completed ? (
          <span className="flex min-h-11 flex-1 items-center justify-center text-sm font-semibold text-success-text">
            ✓ Logged
          </span>
        ) : (
          <button
            type="button"
            onClick={() => {
              onLog({ relog });
              setRelog(false);
            }}
            disabled={logDisabled}
            className="min-h-11 min-w-16 max-w-48 flex-1 cursor-pointer rounded-md bg-accent-warm px-3 text-base font-bold tracking-wide text-accent-warm-fg hover:bg-accent-warm-strong disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            LOG
          </button>
        )}
        {menu}
      </div>
    </div>
  );
}

const whole = (v: number | null) => (v === null ? null : Math.max(0, Math.round(v)));

/** Status color always paired with words — never color alone. */
function ResultLabel({ result }: { result: TargetResult }) {
  const tone =
    result === "met"
      ? "text-success-text"
      : result === "well_above"
        ? "font-semibold text-warning-text"
        : "text-muted";
  return <span className={`shrink-0 text-xs ${tone}`}>{TARGET_RESULT_LABELS[result]}</span>;
}

/** A control with its unit underneath (not a <label>: a tap on the caption
 *  would press a stepper's − button; the controls carry aria-labels). */
function Labeled({ caption, children }: { caption: string; children: React.ReactNode }) {
  return (
    <span className="flex min-w-0 flex-col items-center">
      {children}
      <span className="mt-0.5 whitespace-nowrap text-[10px] leading-none text-muted">{caption}</span>
    </span>
  );
}

function Readout({
  caption,
  value,
  onChange,
  step = 1,
  size,
}: {
  caption: string;
  value: number | null;
  onChange: (value: number | null) => void;
  step?: number;
  size: "sm" | "md";
}) {
  return (
    <label className="flex min-w-0 flex-col">
      <NumberInput value={value} onChange={onChange} min={0} step={step} size={size} className="w-full" />
      <span className="mt-0.5 text-center text-[10px] leading-none text-muted">{caption}</span>
    </label>
  );
}
