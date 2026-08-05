"use client";

import { fractionLabel, scaledMacros } from "@/lib/nutrition";
import type { Food } from "@/lib/types";

/**
 * The plate estimator: a 10 1/16" Dixie plate drawn as SVG with a pie sector
 * sweeping clockwise from 12 o'clock — cover more plate, log more food. A
 * sector's area is linear in its sweep angle, so the slider fraction IS the
 * plate-area fraction; the readout scales the food's per-plate kcal/macros
 * live. Tokens only; the sector must survive dark mode.
 */
export function PlateSlider({
  food,
  fraction,
  onChange,
}: {
  food: Food;
  fraction: number;
  onChange: (fraction: number) => void;
}) {
  const macros = scaledMacros(food, fraction);
  const angle = Math.min(1, Math.max(0, fraction)) * 2 * Math.PI;
  // Sector from 12 o'clock, clockwise. r covers the plate's eating well.
  const r = 86;
  const cx = 100;
  const cy = 100;
  const endX = cx + r * Math.sin(angle);
  const endY = cy - r * Math.cos(angle);
  const largeArc = fraction > 0.5 ? 1 : 0;
  const sectorPath =
    `M ${cx} ${cy} L ${cx} ${cy - r} ` +
    `A ${r} ${r} 0 ${largeArc} 1 ${endX.toFixed(2)} ${endY.toFixed(2)} Z`;

  return (
    <div className="flex flex-col items-center gap-3">
      <svg
        viewBox="0 0 200 200"
        className="w-44 max-w-full sm:w-52"
        role="img"
        aria-label={`${fractionLabel(fraction)} of ${food.name}`}
      >
        {/* Plate rim + eating well — a paper plate seen from above. */}
        <circle cx={cx} cy={cy} r={97} className="fill-surface stroke-border-strong" strokeWidth={2} />
        <circle cx={cx} cy={cy} r={r} className="fill-background stroke-border" strokeWidth={1.5} />
        {/* Covered area */}
        {fraction >= 1 ? (
          <circle cx={cx} cy={cy} r={r} className="fill-accent-soft stroke-accent" strokeWidth={2} />
        ) : fraction > 0 ? (
          <path d={sectorPath} className="fill-accent-soft stroke-accent" strokeWidth={2} strokeLinejoin="round" />
        ) : null}
      </svg>

      <input
        type="range"
        min={5}
        max={100}
        step={5}
        value={Math.round(fraction * 100)}
        onChange={(e) => onChange(Number(e.target.value) / 100)}
        aria-label="Plate fraction"
        className="h-11 w-full cursor-pointer accent-accent"
      />

      <p className="font-mono text-sm">
        <span className="font-semibold">{fractionLabel(fraction)}</span>
        <span className="text-muted"> · ~{Math.round(macros.kcal)} kcal · </span>
        {Math.round(macros.proteinG)}P / {Math.round(macros.carbsG)}C /{" "}
        {Math.round(macros.fatG)}F
      </p>
    </div>
  );
}
