"use client";

import { useMemo, useState } from "react";
import { BodyFigure } from "@/components/body-figure";
import { muscleById } from "@/lib/data/muscles";
import { buildItSuggestions, type ExerciseCatalog } from "@/lib/exercise-catalog";
import { heatBin, type HeatValue } from "@/lib/heat";
import type { MuscleId } from "@/lib/types";

const RAMP = `linear-gradient(to right, ${Array.from({ length: 13 }, (_, i) => `var(--heat-${i})`).join(", ")})`;

/**
 * Front + back body figures with per-muscle heat fill. Tap a region to pin
 * its numbers in the detail row (phone-friendly; no floating tooltip). Zero
 * intensity renders as outline only, receding into the figure.
 */
export function BodyHeatmap({
  values: entries,
  catalog,
  title,
  maxLabel,
}: {
  /** Entries, not a Map — props crossing the server→client boundary stay
   *  plain arrays (see AGENTS.md). Pass `[...map]`. */
  values: readonly (readonly [MuscleId, HeatValue])[];
  catalog: ExerciseCatalog;
  title: string;
  /** Legend label for the top of the scale, e.g. "11.8 sets/wk". */
  maxLabel: string;
}) {
  const values = useMemo(() => new Map(entries), [entries]);
  const [active, setActive] = useState<MuscleId | null>(null);
  const activeValue = active ? values.get(active) : undefined;

  const fill = (muscleId: MuscleId) => {
    const value = values.get(muscleId);
    return value && value.intensity > 0 ? `var(--heat-${heatBin(value.intensity)})` : null;
  };
  const toggle = (muscleId: MuscleId) => setActive((prev) => (prev === muscleId ? null : muscleId));

  return (
    // w-fit + the text block's w-0/min-w-full: the figures alone set the
    // width, so a long "Build it" line wraps instead of widening the column
    // (which squeezed the program page's coverage bars to nothing).
    <div className="w-fit max-w-full">
      <h3 className="mb-2 text-sm font-semibold">{title}</h3>
      <div className="flex gap-2">
        {(["front", "back"] as const).map((view) => (
          <BodyFigure key={view} view={view} fill={fill} selected={active} onSelect={toggle} label={title} />
        ))}
      </div>

      <div className="w-0 min-w-full">
        {/* Fixed-height detail row — tap a muscle to pin it. */}
        <p className="mt-2 min-h-5 font-mono text-xs">
          {active ? (
            (activeValue?.detail ?? `${muscleById.get(active)?.name ?? active} — no work in this view`)
          ) : (
            <span className="text-muted">tap a muscle for numbers</span>
          )}
        </p>

        {/* Suggestions: what would actually move this muscle. */}
        {active && (
          <p className="mt-1 text-xs text-muted">
            Build it:{" "}
            {buildItSuggestions(catalog, active).map(({ exerciseId, name }, i) => (
              <span key={exerciseId}>
                {i > 0 && " · "}
                <span className="text-foreground">{name}</span>
              </span>
            ))}
          </p>
        )}

        <div className="mt-2 flex items-center gap-2 text-[10px] opacity-70">
          <span>0</span>
          <span className="h-2 w-28 rounded-sm" style={{ background: RAMP }} />
          <span>{maxLabel}</span>
        </div>
      </div>
    </div>
  );
}
