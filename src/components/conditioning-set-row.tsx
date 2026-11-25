"use client";

import { useState } from "react";
import { EffortScale } from "@/components/effort-picker";
import { OverflowMenu } from "@/components/overflow-menu";
import { TrashIcon } from "@/components/icons";
import { PiecePicker, type PieceChoice } from "@/components/piece-picker";
import { FOCUS_RING, NumberInput, StepperInput } from "@/components/ui";
import {
  conditioningOf,
  effortLabel,
  feetToMiles,
  lastRideLabel,
  milesToFeet,
  parseIntervalScheme,
  pieceLabel,
  pieceSeconds,
  readoutLabel,
  targetLabel,
  targetResult,
  TARGET_RESULT_LABELS,
  vsLastLabel,
  type BikePast,
  type TargetResult,
} from "@/lib/conditioning";
import { conditioningSetLabel } from "@/lib/session-labels";
import type { ConditioningLog, SetLog } from "@/lib/types";
import { WARMUP_EFFORT } from "@/lib/warmup";

/**
 * One bike piece (Echo Bike) — the conditioning counterpart of SetRow, same
 * contract. Compact: the piece and either the person's target or, once
 * entered, the console's readout. Active, top to bottom: the plan (piece +
 * target — watts to hold in the work bouts on intervals; adjustable for
 * today, their next piece starts from it), their last ride of the same kind,
 * then the two things worth typing after STOP — average watts and how hard
 * it felt — and LOG. The rest of the console (max watts, cadence, distance,
 * calories) and target RPM sit behind "More numbers". Editing a logged piece
 * un-logs it, like SetRow.
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
  last = null,
}: {
  set: SetLog;
  onChange: (changes: Partial<SetLog>) => void;
  onLog: (opts: { relog: boolean }) => void;
  onRemove: () => void;
  active?: boolean;
  onActivate?: () => void;
  logDisabled?: boolean;
  dense?: boolean;
  /** Their last ride of this shape and kind (lastComparable) — the "Last"
   *  line and the "+12 W vs" note. */
  last?: BikePast | null;
}) {
  const [relog, setRelog] = useState(false);
  // Open from the start when this piece already carries one of the extras.
  const [more, setMore] = useState(
    () =>
      set.distanceFeet !== null ||
      [set.conditioning?.maxWatts, set.conditioning?.avgRpm, set.conditioning?.calories, set.conditioning?.targetRpm].some(
        (v) => v != null,
      ),
  );
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

  function setPiece({ intervalScheme, steadySeconds }: PieceChoice) {
    const conditioning = { ...log, intervalScheme };
    edit({ conditioning, durationSeconds: pieceSeconds({ conditioning, durationSeconds: steadySeconds }) });
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

  const interval = parseIntervalScheme(log.intervalScheme) !== null;
  const verdict = log.avgWatts !== null && last ? vsLastLabel(log.avgWatts, last) : null;

  return (
    <div className="space-y-2.5 rounded-lg border-2 border-accent/60 bg-accent-soft px-2 py-2">
      {/* The plan: the piece, and the target big — what you call out on the
          floor. */}
      <div className="flex flex-wrap items-start gap-x-3 gap-y-2">
        <PiecePicker
          scheme={log.intervalScheme}
          steadySeconds={interval ? null : set.durationSeconds}
          onChange={setPiece}
          size={size}
          Field={Labeled}
        />
        <span className="ml-auto">
          <Labeled label={interval ? "target W · work bouts" : "target avg W"}>
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
        </span>
      </div>
      {(last || !target) && (
        <p className="text-xs text-muted">
          {last ? (
            <span className="font-mono text-foreground">{lastRideLabel(last)}</span>
          ) : set.isWarmup ? (
            `Warm-up: brisk, ${WARMUP_EFFORT} — get warm, don't empty the tank.`
          ) : interval ? (
            "No target yet — set the watts to hold in the work bouts."
          ) : (
            "No target yet — set the average watts to hold."
          )}
        </p>
      )}

      {/* After STOP: the console's average and how hard it felt. Effort is a
          self-report, not a console number, so picking one doesn't un-log
          the piece. */}
      <div role="group" aria-label="Console readout" className="space-y-2">
        <div className="flex flex-wrap items-start gap-x-4 gap-y-2">
          <label className="flex flex-col gap-1">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted">avg watts</span>
            <NumberInput
              value={log.avgWatts}
              onChange={(v) => editLog({ avgWatts: whole(v) })}
              min={0}
              size="md"
              className="h-14! w-28 text-2xl! font-bold"
            />
          </label>
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">
              Effort <span className="font-normal normal-case tracking-normal">(1 easy – 10 all-out)</span>
            </p>
            <EffortScale
              value={log.effort ?? null}
              onChange={(value) => onChange({ conditioning: { ...log, effort: value } })}
              label="Piece effort"
              grid={dense}
            />
          </div>
        </div>
        {(verdict || result) && (
          <p className="flex flex-wrap items-center gap-x-3 text-sm">
            {verdict && <span className="font-mono font-semibold">{verdict}</span>}
            {result && <ResultLabel result={result} />}
          </p>
        )}

        <button
          type="button"
          onClick={() => setMore((open) => !open)}
          aria-expanded={more}
          className={`inline-flex min-h-9 cursor-pointer items-center rounded-md px-1.5 text-xs text-muted hover:bg-current/5 pointer-coarse:min-h-11 ${FOCUS_RING}`}
        >
          More numbers {more ? "▴" : "▾"}
        </button>
        {more && (
          // The rest of the frozen screen, in the console's order (speed is
          // skipped — it's derived from watts), then the optional RPM target.
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-2 @sm:grid-cols-4">
              <Readout caption="max watts" value={log.maxWatts} onChange={(v) => editLog({ maxWatts: whole(v) })} size={size} />
              <Readout caption="avg cadence" value={log.avgRpm} onChange={(v) => editLog({ avgRpm: whole(v) })} size={size} />
              <Readout
                caption="distance mi"
                step={0.01}
                value={set.distanceFeet === null ? null : Number(feetToMiles(set.distanceFeet).toFixed(2))}
                onChange={(v) => edit({ distanceFeet: v === null ? null : milesToFeet(v) })}
                size={size}
              />
              <Readout caption="calories" value={log.calories} onChange={(v) => editLog({ calories: whole(v) })} size={size} />
            </div>
            <Labeled label={interval ? "target rpm · work bouts" : "target rpm"} align="start">
              <StepperInput
                size={size}
                value={log.targetRpm}
                onChange={(v) => editLog({ targetRpm: v || null })}
                max={250}
                label="target rpm"
                className="w-14"
              />
            </Labeled>
          </div>
        )}
      </div>

      <div className="flex items-center gap-2">
        {set.completed ? (
          <span className="flex min-h-12 flex-1 items-center justify-center text-sm font-semibold text-success-text">
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
            className="min-h-12 flex-1 cursor-pointer rounded-md bg-accent-warm px-3 text-base font-bold tracking-wide text-accent-warm-fg hover:bg-accent-warm-strong disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
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

/** A control with its caption underneath (not a <label>: a tap on the
 *  caption would press a stepper's − button; the controls carry
 *  aria-labels). */
function Labeled({
  label,
  align = "center",
  children,
}: {
  label: string;
  align?: "center" | "start";
  children: React.ReactNode;
}) {
  return (
    <span className={`flex min-w-0 flex-col ${align === "center" ? "items-center" : "items-start"}`}>
      {children}
      <span className="mt-1 whitespace-nowrap text-xs leading-none text-muted">{label}</span>
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
      <span className="mt-1 text-center text-xs leading-none text-muted">{caption}</span>
    </label>
  );
}
