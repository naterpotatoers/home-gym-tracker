"use client";

import { useId, useState } from "react";
import { bodyMap, silhouettes, type BodyView } from "@/lib/body-map";
import { exerciseById, exerciseMuscleScores } from "@/lib/data/exercises";
import { muscleById } from "@/lib/data/muscles";
import { heatBin, type HeatValue } from "@/lib/heat";
import type { MuscleId } from "@/lib/types";

const MUSCLE_IDS = Object.keys(bodyMap) as MuscleId[];

/** Exercises that meaningfully train a muscle (score ≥ 5), best first — the
 *  tap-a-region suggestion list for filling a red spot. */
function exercisesFor(muscleId: MuscleId): { name: string; score: number }[] {
  return exerciseMuscleScores
    .filter((r) => r.muscleId === muscleId && r.score >= 5)
    .sort((a, b) => b.score - a.score)
    .slice(0, 4)
    .map((r) => ({
      name: exerciseById.get(r.exerciseId)?.name ?? r.exerciseId,
      score: r.score,
    }));
}

/**
 * Front + back body figures with per-muscle heat fill. Tap a region to pin
 * its numbers in the detail row (phone-friendly; no floating tooltip).
 * Ordinal-only work (bands, no lb value) is hatched — visible, never faking
 * pounds. Zero intensity renders as outline only, receding into the figure.
 */
export function BodyHeatmap({
  values,
  title,
  maxLabel,
  ordinalMaxLabel,
}: {
  values: ReadonlyMap<MuscleId, HeatValue>;
  title: string;
  /** Legend label for the top of the shared scale, e.g. "12,400 lb·reps". */
  maxLabel: string;
  /** Legend label for the separate ordinal (band) scale, if any is present. */
  ordinalMaxLabel?: string;
}) {
  const uid = useId();
  const [active, setActive] = useState<MuscleId | null>(null);
  const hasOrdinal = [...values.values()].some((v) => v.ordinalOnly);
  const activeValue = active ? values.get(active) : undefined;

  function regionFill(muscleId: MuscleId): { fill: string; hatch: boolean } {
    const value = values.get(muscleId);
    if (!value || value.intensity <= 0) return { fill: "none", hatch: false };
    return {
      fill: `var(--heat-${heatBin(value.intensity)})`,
      hatch: value.ordinalOnly,
    };
  }

  function renderView(view: BodyView) {
    return (
      <svg
        viewBox="0 0 200 440"
        className="w-36 sm:w-44"
        role="img"
        aria-label={`${title} — ${view} view`}
      >
        <defs>
          <pattern
            id={`${uid}-hatch-${view}`}
            width="6"
            height="6"
            patternUnits="userSpaceOnUse"
            patternTransform="rotate(45)"
          >
            <line x1="0" y1="0" x2="0" y2="6" stroke="currentColor" strokeWidth="1.5" opacity="0.5" />
          </pattern>
        </defs>

        {/* Figure outline: half path stroked twice, mirrored. */}
        {[false, true].map((mirrored) => (
          <path
            key={String(mirrored)}
            d={silhouettes[view]}
            fill="none"
            stroke="currentColor"
            strokeOpacity="0.2"
            strokeWidth="1.5"
            transform={mirrored ? "translate(200,0) scale(-1,1)" : undefined}
          />
        ))}

        {MUSCLE_IDS.flatMap((muscleId) =>
          bodyMap[muscleId]
            .filter((region) => region.view === view)
            .flatMap((region, regionIndex) => {
              const { fill, hatch } = regionFill(muscleId);
              const copies = region.mirror ? [false, true] : [false];
              return copies.map((mirrored) => {
                const transform = mirrored
                  ? "translate(200,0) scale(-1,1)"
                  : undefined;
                return (
                  <g key={`${muscleId}-${regionIndex}-${mirrored}`} transform={transform}>
                    <path
                      d={region.d}
                      fill={fill}
                      stroke="currentColor"
                      strokeOpacity={active === muscleId ? 0.9 : 0.15}
                      strokeWidth={active === muscleId ? 1.5 : 1}
                      strokeDasharray={region.deep ? "3 2" : undefined}
                      className="cursor-pointer"
                      onClick={() => setActive((prev) => (prev === muscleId ? null : muscleId))}
                    >
                      <title>{muscleById.get(muscleId)?.name ?? muscleId}</title>
                    </path>
                    {hatch && (
                      <path
                        d={region.d}
                        fill={`url(#${uid}-hatch-${view})`}
                        stroke="none"
                        pointerEvents="none"
                      />
                    )}
                  </g>
                );
              });
            }),
        )}
      </svg>
    );
  }

  return (
    <div>
      <h3 className="mb-2 text-sm font-semibold">{title}</h3>
      <div className="flex gap-2">
        {renderView("front")}
        {renderView("back")}
      </div>

      {/* Fixed-height detail row — tap a muscle to pin it. */}
      <p className="mt-2 min-h-5 font-mono text-xs opacity-80">
        {active ? (
          (activeValue?.detail ??
            `${muscleById.get(active)?.name ?? active} — no work in this view`)
        ) : (
          <span className="opacity-60">tap a muscle for numbers</span>
        )}
      </p>

      {/* Suggestions: what would actually move this muscle. */}
      {active && (
        <p className="mt-1 text-xs text-muted">
          Build it:{" "}
          {exercisesFor(active).map(({ name, score }, i) => (
            <span key={name}>
              {i > 0 && " · "}
              <span className="text-foreground">{name}</span>{" "}
              <span className="font-mono">({score})</span>
            </span>
          ))}
        </p>
      )}

      {/* Legend: the shared scale, plus the ordinal hatch key when present. */}
      <div className="mt-2 flex items-center gap-2 text-[10px] opacity-70">
        <span>0</span>
        <span
          className="h-2 w-28 rounded-sm"
          style={{
            background: `linear-gradient(to right, ${Array.from(
              { length: 13 },
              (_, i) => `var(--heat-${i})`,
            ).join(", ")})`,
          }}
        />
        <span>{maxLabel}</span>
        {hasOrdinal && (
          <span className="ml-3 flex items-center gap-1">
            <svg viewBox="0 0 12 12" className="size-3">
              <rect width="12" height="12" fill="var(--heat-6)" />
              <path d="M0 12 L12 0 M-3 6 L6 -3 M6 15 L15 6" stroke="currentColor" strokeWidth="1.5" opacity="0.5" />
            </svg>
            band work{ordinalMaxLabel ? ` (max ${ordinalMaxLabel})` : ""}
          </span>
        )}
      </div>
    </div>
  );
}
