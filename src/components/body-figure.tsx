"use client";

import { useId } from "react";
import { bodyMap, silhouettes, type BodyView } from "@/lib/body-map";
import { muscleById } from "@/lib/data/muscles";
import type { MuscleId } from "@/lib/types";

const MUSCLE_IDS = Object.keys(bodyMap) as MuscleId[];
const MIRROR = "translate(200,0) scale(-1,1)";

/**
 * One body view (front or back) from body-map.ts: the silhouette, every
 * muscle region filled by `fill` (null → outline only), and tap-to-select. The shared figure behind the heat
 * map, "Explain exercise" and the Library's muscle explorer.
 */
export function BodyFigure({
  view,
  fill,
  selected = null,
  onSelect,
  label,
  className = "w-36 sm:w-44",
}: {
  view: BodyView;
  /** A CSS color for the region, or null to leave it as an outline. */
  fill: (muscleId: MuscleId) => string | null;
  selected?: MuscleId | null;
  onSelect?: (muscleId: MuscleId) => void;
  /** Accessible name — the view is appended. */
  label: string;
  className?: string;
}) {
  const uid = useId();
  const clipId = `${uid}-clip-${view}`;
  // The half outline runs head-top → crotch; closing it up the midline
  // gives one closed half, and its mirror the other.
  const halfShape = `${silhouettes[view]} Z`;
  return (
    <svg viewBox="0 0 200 440" className={className} role="img" aria-label={`${label} — ${view} view`}>
      <defs>
        {/* Regions are clipped to the figure, so nothing can spill past it. */}
        <clipPath id={clipId}>
          <path d={halfShape} />
          <path d={halfShape} transform={MIRROR} />
        </clipPath>
      </defs>

      {/* A faint body fill so unworked muscles read as body, not holes. */}
      {[false, true].map((mirrored) => (
        <path
          key={`fill-${mirrored}`}
          d={halfShape}
          fill="currentColor"
          fillOpacity="0.04"
          stroke="none"
          transform={mirrored ? MIRROR : undefined}
        />
      ))}

      {/* Figure outline: half path stroked twice, mirrored. */}
      {[false, true].map((mirrored) => (
        <path
          key={String(mirrored)}
          d={silhouettes[view]}
          fill="none"
          stroke="currentColor"
          strokeOpacity="0.2"
          strokeWidth="1.5"
          transform={mirrored ? MIRROR : undefined}
        />
      ))}

      <g clipPath={`url(#${clipId})`}>
        {MUSCLE_IDS.flatMap((muscleId) =>
          bodyMap[muscleId]
            .filter((region) => region.view === view)
            .flatMap((region, regionIndex) => {
              const color = fill(muscleId);
              const isSelected = selected === muscleId;
              return (region.mirror ? [false, true] : [false]).map((mirrored) => (
                <path
                    key={`${muscleId}-${regionIndex}-${mirrored}`}
                    transform={mirrored ? MIRROR : undefined}
                    d={region.d}
                    fill={color ?? "none"}
                    stroke={isSelected ? "var(--color-accent)" : "currentColor"}
                    strokeOpacity={isSelected ? 1 : 0.15}
                    strokeWidth={isSelected ? 2.5 : 1}
                    strokeDasharray={region.deep ? "3 2" : undefined}
                    className={onSelect ? "cursor-pointer" : undefined}
                    // Tappable inside even when unfilled (fill="none" would
                    // otherwise only catch taps on the thin stroke).
                    pointerEvents={onSelect ? "visible" : undefined}
                    onClick={onSelect ? () => onSelect(muscleId) : undefined}
                  >
                    <title>{muscleById.get(muscleId)?.name ?? muscleId}</title>
                  </path>
              ));
            }),
        )}
      </g>
    </svg>
  );
}
