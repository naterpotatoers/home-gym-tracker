"use client";

import { useState } from "react";
import type { ChartPoint, TrendSegment } from "@/lib/meters";

// Re-exported so component-side importers keep one import; the definitions
// live in lib (meters.ts) so the pure query layer never imports a component.
export type { ChartPoint, TrendSegment };

const W = 640;
const H = 260;
const L = 48;
const R = 14;
const T = 10;
const B = 22;

function ms(date: string): number {
  return new Date(`${date}T00:00:00Z`).getTime();
}

/**
 * Hand-rolled SVG strength-progress line: time-scaled x (a three-month layoff
 * must read as a gap, so never index-scaled), non-zero-based y (zero-basing
 * flattens progress), dashed projection past the last session. Tap a point to
 * pin its numbers — same pattern as the body heatmap. Tokens only, no hex.
 */
export function ProgressChart({
  points,
  trend,
  yUnit = "lb",
  label = "Estimated one-rep max over time",
}: {
  points: ChartPoint[];
  trend: TrendSegment | null;
  yUnit?: string;
  label?: string;
}) {
  const [pinned, setPinned] = useState<number | null>(null);
  if (points.length === 0) return null;

  const xMin = ms(points[0].date);
  const xMax = Math.max(
    ms(points[points.length - 1].date),
    trend ? ms(trend.toDate) : -Infinity,
  );
  const xSpan = Math.max(1, xMax - xMin);

  const yValues = [
    ...points.map((p) => p.y),
    ...(trend ? [trend.fromY, trend.toY] : []),
  ];
  const NICE_STEPS = [5, 10, 25, 50, 100];
  const rawStep = (Math.max(...yValues) - Math.min(...yValues)) / 4 || 5;
  const step =
    NICE_STEPS.find((s) => s >= rawStep) ?? Math.ceil(rawStep / 100) * 100;
  let yMin = Math.floor(Math.min(...yValues) / step) * step;
  let yMax = Math.ceil(Math.max(...yValues) / step) * step;
  if (yMin === yMax) {
    yMin -= step;
    yMax += step;
  }

  const X = (date: string) => L + ((ms(date) - xMin) / xSpan) * (W - L - R);
  const Y = (v: number) => T + (1 - (v - yMin) / (yMax - yMin)) * (H - T - B);

  const gridValues: number[] = [];
  for (let v = yMin; v <= yMax; v += step) gridValues.push(v);

  // x labels: first and last session, plus the projection end.
  const xLabels: { date: string; label: string }[] = [
    { date: points[0].date, label: points[0].date.slice(5) },
  ];
  if (points.length > 1) {
    const last = points[points.length - 1].date;
    xLabels.push({ date: last, label: last.slice(5) });
  }
  if (trend) xLabels.push({ date: trend.toDate, label: "+8wk" });

  const mid =
    trend === null
      ? null
      : {
          x: (X(trend.fromDate) + X(trend.toDate)) / 2,
          y: (Y(trend.fromY) + Y(trend.toY)) / 2,
        };

  return (
    <div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="h-auto w-full"
        role="img"
        aria-label={`${label}, in ${yUnit}`}
      >
        {gridValues.map((v) => (
          <g key={v}>
            <line
              x1={L}
              x2={W - R}
              y1={Y(v)}
              y2={Y(v)}
              className="stroke-border"
              strokeWidth={1}
            />
            <text
              x={L - 6}
              y={Y(v) + 3}
              textAnchor="end"
              className="fill-current font-mono text-[10px] text-muted"
            >
              {v}
            </text>
          </g>
        ))}

        {xLabels.map(({ date, label }) => (
          <text
            key={`${date}-${label}`}
            x={X(date)}
            y={H - 6}
            textAnchor="middle"
            className="fill-current font-mono text-[10px] text-muted"
          >
            {label}
          </text>
        ))}

        {trend && (
          <g className="stroke-accent" opacity={0.6}>
            <line
              x1={X(trend.fromDate)}
              y1={Y(trend.fromY)}
              x2={X(trend.toDate)}
              y2={Y(trend.toY)}
              strokeWidth={2}
              strokeDasharray="5 5"
            />
            {mid && (
              <circle cx={mid.x} cy={mid.y} r={3.5} className="fill-surface" strokeWidth={1.5} />
            )}
            <circle
              cx={X(trend.toDate)}
              cy={Y(trend.toY)}
              r={3.5}
              className="fill-surface"
              strokeWidth={1.5}
            />
          </g>
        )}

        {points.length > 1 && (
          <polyline
            points={points.map((p) => `${X(p.date)},${Y(p.y)}`).join(" ")}
            fill="none"
            className="stroke-accent"
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        )}

        {points.map((p, i) => (
          <g key={p.sessionId}>
            <circle cx={X(p.date)} cy={Y(p.y)} r={3.5} className="fill-accent" />
            <circle
              cx={X(p.date)}
              cy={Y(p.y)}
              r={14}
              fill="transparent"
              className="cursor-pointer"
              onClick={() => setPinned((prev) => (prev === i ? null : i))}
            />
          </g>
        ))}
      </svg>

      <p className="mt-1 min-h-5 font-mono text-xs opacity-80">
        {pinned !== null ? (
          points[pinned].detail
        ) : (
          <span className="text-muted">
            {points.length === 1
              ? "one point logged — the line appears with the second"
              : trend === null
                ? "tap a point for numbers · trend needs 3+ points across 2+ weeks"
                : "tap a point for numbers · dashed = 8-week projection"}
          </span>
        )}
      </p>
    </div>
  );
}
