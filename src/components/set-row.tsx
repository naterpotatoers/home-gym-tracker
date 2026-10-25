"use client";

import { OverflowMenu } from "@/components/overflow-menu";
import { TrashIcon } from "@/components/icons";
import { Select, StepperInput } from "@/components/ui";
import { bands } from "@/lib/data/equipment";
import { describePlates, formatPlates, weightStep } from "@/lib/loading";
import { bandLabel } from "@/lib/queries";
import type { BandId, BandRole, MetricType, SetLog } from "@/lib/types";

/**
 * One set. Compact by default — a single line of plain text (tap to edit,
 * no keyboard) so a whole exercise fits on an iPad card; a logged set shows
 * ✓ in place of its number. The ACTIVE row (the current set, or whichever
 * row was tapped) is one line of steppers for load and reps with LOG — the
 * one filled button on the screen — beside them; units sit as captions under
 * the steppers. In a narrow card (3 people across the board) the row is two
 * lines instead: both steppers stretched half-and-half, then LOG. RIR (rarely set), the warm-up toggle, un-logging, and delete
 * live in the row's ⋯ menu.
 */
export function SetRow({
  set,
  metricType,
  bandRoles = [],
  onChange,
  onLog,
  onRemove,
  active = false,
  onActivate,
  logDisabled = false,
  dense = false,
}: {
  set: SetLog;
  metricType: MetricType;
  /** Valid roles for this set's variant — computed by the parent from the
   *  catalog so this row doesn't need one. */
  bandRoles?: readonly BandRole[];
  onChange: (changes: Partial<SetLog>) => void;
  /** LOG: marks the set done and starts the rest timer. */
  onLog: () => void;
  onRemove: () => void;
  active?: boolean;
  /** Tap on a compact row — make it the active (editable) one. */
  onActivate?: () => void;
  logDisabled?: boolean;
  /** Group-board cards: 36px controls with a mouse (44px on touch). */
  dense?: boolean;
}) {
  const controlSize = dense ? ("sm" as const) : ("md" as const);
  const timed = metricType === "time" || set.durationSeconds !== null;
  const distance = !timed && metricType === "distance";

  const nextRir = set.rir === null ? 0 : set.rir >= 4 ? null : set.rir + 1;
  const menu = (
    <OverflowMenu
      label={`Set ${set.setNumber} actions`}
      items={[
        {
          label: `RIR ${set.rir ?? "–"} → ${nextRir ?? "–"}`,
          onSelect: () => onChange({ rir: nextRir }),
        },
        {
          label: set.isWarmup ? "Make working set" : "Make warm-up",
          onSelect: () => onChange({ isWarmup: !set.isWarmup }),
        },
        ...(set.completed
          ? [{ label: "Mark not done", onSelect: () => onChange({ completed: false }) }]
          : []),
        { label: "Delete set", icon: <TrashIcon size={16} />, onSelect: onRemove, danger: true },
      ]}
    />
  );

  if (!active) {
    return (
      <div
        className={`flex min-h-11 items-center gap-1.5 rounded-lg px-1 ${
          set.completed ? "bg-success/10" : ""
        } ${set.isWarmup ? "opacity-70" : ""}`}
      >
        <span
          className={`w-6 shrink-0 text-center font-mono text-xs ${
            set.completed
              ? "font-semibold text-success-text"
              : set.isWarmup
                ? "font-semibold text-warning-text"
                : "text-muted"
          }`}
          title={set.isWarmup ? "Warm-up set" : undefined}
        >
          {set.completed ? (
            <>
              ✓<span className="sr-only"> logged</span>
            </>
          ) : set.isWarmup ? (
            "W"
          ) : (
            set.setNumber
          )}
        </span>
        <button
          type="button"
          onClick={onActivate}
          aria-label={`Edit set ${set.setNumber}: ${summary(set, timed, distance)}`}
          className="flex min-h-9 min-w-0 flex-1 cursor-pointer items-center gap-3 rounded-md px-1 text-left font-mono text-sm hover:bg-current/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 pointer-coarse:min-h-11"
        >
          <span className="truncate">{summary(set, timed, distance)}</span>
          {set.rir !== null && (
            <span className="shrink-0 text-xs text-muted">
              {set.rir === 0 ? "to failure" : `RIR ${set.rir}`}
            </span>
          )}
        </button>
        {menu}
      </div>
    );
  }

  const step = weightStep(set.modalityId);
  const plates =
    set.modalityId === "barbell" && set.weightLbs !== null ? formatPlates(set.weightLbs) : null;
  const plateHint = plates ? describePlates(plates) : null;
  const roles = set.modalityId === "band" ? bandRoles : [];

  return (
    <div
      // Layout follows the CARD's width (the block list is the @container),
      // not the viewport: one line when the row fits, else two lines.
      className={`grid grid-cols-2 items-start gap-x-2 gap-y-1.5 rounded-lg border-2 border-accent/60 bg-accent-soft px-1.5 py-1.5 @min-[27rem]:grid-cols-[auto_auto_1fr] ${
        set.isWarmup ? "opacity-80" : ""
      }`}
    >
      {/* Load */}
      {set.modalityId === "band" ? (
        <span className="flex min-w-0 items-center gap-1">
          <Select
            size={controlSize}
            value={set.bandId ?? ""}
            onChange={(e) => onChange({ bandId: (e.target.value || null) as BandId | null })}
            aria-label="Band"
            className="min-w-0 flex-1 @min-[27rem]:max-w-36"
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
              aria-label="Band role"
              className="min-w-0 flex-1"
            >
              {roles.map((role) => (
                <option key={role} value={role}>
                  {role}
                </option>
              ))}
            </Select>
          )}
        </span>
      ) : set.modalityId === "bodyweight" ? (
        <Captioned caption="BW + lb">
          <StepperInput
            size={controlSize}
            step={step ?? 2.5}
            value={set.addedWeightLbs}
            onChange={(v) => onChange({ addedWeightLbs: v || null })}
            label="added weight"
            className={`w-14 ${FILL_INPUT}`}
            wrapperClassName={FILL_WRAPPER}
          />
        </Captioned>
      ) : (
        <Captioned
          caption={`lb${set.modalityId === "dumbbell" ? " ea" : ""}${
            plateHint ? ` · ${plateHint}` : ""
          }`}
        >
          <StepperInput
            size={controlSize}
            step={step ?? 5}
            value={set.weightLbs}
            onChange={(v) => onChange({ weightLbs: v })}
            label="weight"
            className={`w-14 ${FILL_INPUT}`}
            wrapperClassName={FILL_WRAPPER}
          />
        </Captioned>
      )}

      {/* Metric */}
      {timed ? (
        <Captioned caption="sec">
          <StepperInput
            size={controlSize}
            step={5}
            value={set.durationSeconds}
            onChange={(v) => onChange({ durationSeconds: v })}
            label="seconds"
            className={`w-12 ${FILL_INPUT}`}
            wrapperClassName={FILL_WRAPPER}
          />
        </Captioned>
      ) : distance ? (
        <Captioned caption="ft">
          <StepperInput
            size={controlSize}
            step={10}
            value={set.distanceFeet}
            onChange={(v) => onChange({ distanceFeet: v })}
            label="distance"
            className={`w-14 ${FILL_INPUT}`}
            wrapperClassName={FILL_WRAPPER}
          />
        </Captioned>
      ) : (
        <Captioned caption={`reps${set.unilateralMode !== "bilateral" ? "/side" : ""}`}>
          <StepperInput
            size={controlSize}
            value={set.reps}
            onChange={(v) => onChange({ reps: v })}
            label="reps"
            className={`w-11 ${FILL_INPUT}`}
            wrapperClassName={FILL_WRAPPER}
          />
        </Captioned>
      )}

      {/* LOG + ⋯ — the rest of the line, or a line of their own when narrow */}
      <span className="col-span-2 flex items-center justify-end gap-1 @min-[27rem]:col-span-1">
        {set.completed ? (
          <span className="flex min-h-11 flex-1 items-center justify-center text-sm font-semibold text-success-text">
            ✓ Logged
          </span>
        ) : (
          <button
            type="button"
            onClick={onLog}
            disabled={logDisabled}
            // The one FILLED button on the screen — logging a set is the action.
            className="min-h-11 min-w-16 flex-1 cursor-pointer @min-[27rem]:max-w-48 rounded-md bg-accent-warm px-3 text-base font-bold tracking-wide text-accent-warm-fg hover:bg-accent-warm-strong disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            LOG
          </button>
        )}
        {menu}
      </span>
    </div>
  );
}

/** Narrow card: each stepper stretches across its half of the row — the
 *  input grows, the −/+ buttons sit at the edges. */
const FILL_WRAPPER = "@max-[27rem]:w-full";
const FILL_INPUT = "@max-[27rem]:w-0 @max-[27rem]:flex-1 @max-[27rem]:px-1 @max-[27rem]:text-center";

/** A stepper with its unit as a small caption underneath, so units never
 *  cost width on the line. */
function Captioned({ caption, children }: { caption: string; children: React.ReactNode }) {
  return (
    <span className="flex min-w-0 flex-col items-center">
      {children}
      <span className="mt-0.5 whitespace-nowrap text-[10px] leading-none text-muted">
        {caption}
      </span>
    </span>
  );
}

/** The compact row's text — load as entered (dumbbells per hand, bands by
 *  color, hip bands never in pounds) × the metric. */
function summary(set: SetLog, timed: boolean, distance: boolean): string {
  let load = "";
  if (set.modalityId === "band") load = set.bandId ? `${bandLabel(set)} band` : "band?";
  else if (set.modalityId === "bodyweight") {
    load = set.addedWeightLbs ? `BW+${set.addedWeightLbs}` : "BW";
  } else {
    load = set.weightLbs === null ? "— lb" : `${set.weightLbs} lb${set.modalityId === "dumbbell" ? " ea" : ""}`;
  }
  const amount = timed
    ? `${set.durationSeconds ?? "—"}s`
    : distance
      ? `${set.distanceFeet ?? "—"} ft`
      : `${set.reps ?? "—"}${set.unilateralMode !== "bilateral" ? "/side" : ""}`;
  return `${load} × ${amount}`;
}
