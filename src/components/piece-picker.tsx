"use client";

import { useState } from "react";
import { Select, StepperInput } from "@/components/ui";
import {
  CONSOLE_PRESETS,
  DEFAULT_STEADY_SECONDS,
  formatIntervalScheme,
  parseIntervalScheme,
  schemeSeconds,
  type IntervalScheme,
} from "@/lib/conditioning";
import { mmss } from "@/lib/periods";

const STEADY = "steady";
const CUSTOM = "custom";
/** Where "Custom…" starts from a steady piece: 10 rounds of 30 on / 30 off. */
const CUSTOM_START: IntervalScheme = { rounds: 10, workSeconds: 30, restSeconds: 30 };

export type PieceChoice = {
  /** Null = a steady piece. */
  intervalScheme: string | null;
  /** A steady piece's length; null for an interval piece (its scheme times
   *  it — pieceSeconds). */
  steadySeconds: number | null;
};

/**
 * What one bike piece is: a console preset (20/10 ×8, 10/20 ×8), a custom
 * interval (rounds × work / rest) or a steady ride of N minutes — shared by
 * the routine editor's bike row and the live piece card so the two can't
 * drift. Renders bare fields; `Field` is the caller's label wrapper (label
 * above in the editor, caption below on the card).
 */
export function PiecePicker({
  scheme,
  steadySeconds,
  onChange,
  size,
  Field,
}: {
  scheme: string | null;
  /** The piece's length while it's steady (ignored for intervals). */
  steadySeconds: number | null;
  onChange: (piece: PieceChoice) => void;
  size: "sm" | "md";
  Field: React.ComponentType<{ label: string; children: React.ReactNode }>;
}) {
  const parsed = parseIntervalScheme(scheme);
  const isPreset = CONSOLE_PRESETS.some((p) => p.scheme === scheme);
  // "Custom…" stays open even while its numbers happen to match a preset.
  const [customOpen, setCustomOpen] = useState(false);
  const custom = parsed !== null && (customOpen || !isPreset);

  function pick(value: string) {
    if (value === STEADY) {
      setCustomOpen(false);
      onChange({
        intervalScheme: null,
        // Coming from intervals there's no steady length yet — the console's
        // manual 5:00.
        steadySeconds: parsed ? DEFAULT_STEADY_SECONDS : (steadySeconds ?? DEFAULT_STEADY_SECONDS),
      });
    } else if (value === CUSTOM) {
      setCustomOpen(true);
      if (!parsed) onChange({ intervalScheme: formatIntervalScheme(CUSTOM_START), steadySeconds: null });
    } else {
      setCustomOpen(false);
      onChange({ intervalScheme: value, steadySeconds: null });
    }
  }

  /** Clamped to what the scheme text (and the DB check) can hold. */
  function setCustom(changes: Partial<IntervalScheme>) {
    const next = { ...(parsed ?? CUSTOM_START), ...changes };
    onChange({
      intervalScheme: formatIntervalScheme({
        rounds: clamp(next.rounds, 1, 99),
        workSeconds: clamp(next.workSeconds, 1, 999),
        restSeconds: clamp(next.restSeconds, 0, 999),
      }),
      steadySeconds: null,
    });
  }

  return (
    <>
      <Field label="Piece">
        <Select
          size={size}
          value={custom ? CUSTOM : (scheme ?? STEADY)}
          onChange={(e) => pick(e.target.value)}
          aria-label="Piece"
        >
          {CONSOLE_PRESETS.map((p) => (
            <option key={p.scheme} value={p.scheme}>
              {p.label}
            </option>
          ))}
          <option value={CUSTOM}>Custom…</option>
          <option value={STEADY}>Steady</option>
        </Select>
      </Field>
      {custom && parsed && (
        <>
          <Field label="Rounds">
            <StepperInput size={size} value={parsed.rounds} min={1} max={99} onChange={(v) => v && setCustom({ rounds: v })} label="rounds" className="w-12" />
          </Field>
          <Field label="Work s">
            <StepperInput size={size} value={parsed.workSeconds} min={5} max={995} step={5} onChange={(v) => v && setCustom({ workSeconds: v })} label="work seconds" className="w-14" />
          </Field>
          <Field label="Rest s">
            <StepperInput size={size} value={parsed.restSeconds} min={0} max={995} step={5} onChange={(v) => v !== null && setCustom({ restSeconds: v })} label="rest seconds" className="w-14" />
          </Field>
        </>
      )}
      {scheme === null && (
        <Field label="Minutes">
          <StepperInput
            size={size}
            value={steadySeconds === null ? null : Math.round(steadySeconds / 60)}
            onChange={(v) => onChange({ intervalScheme: null, steadySeconds: v ? v * 60 : null })}
            min={1}
            max={60}
            label="minutes"
            className="w-12"
          />
        </Field>
      )}
      {/* A preset's length is in its name's console button (4:00); a custom
          interval's isn't obvious, so it's spelled out. */}
      {custom && parsed && (
        <Field label="Time">
          <span className={`flex items-center font-mono text-sm text-muted ${size === "sm" ? "min-h-9 pointer-coarse:min-h-11" : "min-h-11"}`}>
            {mmss(schemeSeconds(parsed))}
          </span>
        </Field>
      )}
    </>
  );
}

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, Math.round(n)));
