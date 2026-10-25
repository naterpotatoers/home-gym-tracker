"use client";

import { useEffect, useRef, useState } from "react";
import type { ChartPoint, TrendSegment } from "@/lib/meters";

/** The SVG is drawn in rendered pixels (viewBox width = measured width), so
 *  12px axis text is 12px on a phone too and the hit bands' size is real.
 *  640 is only the pre-measure SSR guess. */
const DEFAULT_W = 640;
const H = 240;
const L = 44;
const R = 14;
const T = 10;
const B = 24;

function ms(date: string): number {
  return new Date(`${date}T00:00:00Z`).getTime();
}

/**
 * Hand-rolled SVG strength-progress line: time-scaled x (a three-month layoff
 * must read as a gap, so never index-scaled), non-zero-based y (zero-basing
 * flattens progress), dashed projection past the last session. Tap anywhere
 * in a session's full-height x-band (midpoint to midpoint, so the whole plot
 * is hittable and every band is ≥44px tall) to pin its numbers — same
 * pattern as the body heatmap. Tokens only, no hex.
 */
export function ProgressChart({
  points,
  trend,
  label = "Estimated one-rep max over time",
}: {
  points: ChartPoint[];
  trend: TrendSegment | null;
  label?: string;
}) {
  const [pinned, setPinned] = useState<number | null>(null);
  const [W, setW] = useState(DEFAULT_W);
  const boxRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      const width = Math.round(entry.contentRect.width);
      if (width > 0) setW(width);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  if (points.length === 0) return null;
  // Points can change under a kept-alive chart; a stale pin must not index
  // past the end.
  const active = pinned !== null && pinned < points.length ? pinned : null;

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

  // Hit bands: each session owns the x-span from the midpoint with its left
  // neighbor to the midpoint with its right one, full plot height.
  const xs = points.map((p) => X(p.date));
  const bands = xs.map((x, i) => {
    const left = i === 0 ? L : (xs[i - 1] + x) / 2;
    const right = i === xs.length - 1 ? W - R : (x + xs[i + 1]) / 2;
    return { x: left, width: Math.max(0, right - left) };
  });

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
    <div ref={boxRef}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="h-auto w-full select-none"
        role="img"
        aria-label={`${label}, in lb`}
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
              className="fill-current font-mono text-[12px] text-muted"
            >
              {v}
            </text>
          </g>
        ))}

        {xLabels.map(({ date, label }, i) => (
          <text
            key={`${date}-${label}`}
            x={X(date)}
            y={H - 6}
            // Edge labels anchor inward so they never clip at the frame.
            textAnchor={i === 0 ? "start" : i === xLabels.length - 1 ? "end" : "middle"}
            className="fill-current font-mono text-[12px] text-muted"
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

        {active !== null && (
          <line
            x1={xs[active]}
            x2={xs[active]}
            y1={T}
            y2={H - B}
            className="stroke-accent"
            strokeWidth={1}
            opacity={0.4}
          />
        )}

        {points.map((p, i) => (
          <circle
            key={p.sessionId}
            cx={xs[i]}
            cy={Y(p.y)}
            r={i === active ? 5.5 : 3.5}
            className={i === active ? "fill-accent stroke-surface" : "fill-accent"}
            strokeWidth={i === active ? 2 : 0}
          />
        ))}

        {points.map((p, i) => (
          <rect
            key={`hit-${p.sessionId}`}
            x={bands[i].x}
            y={T}
            width={bands[i].width}
            height={H - T - B}
            role="button"
            tabIndex={0}
            aria-label={p.detail}
            aria-pressed={i === active}
            className="cursor-pointer fill-transparent outline-none hover:fill-current/5 focus-visible:fill-accent/15"
            onClick={() => setPinned((prev) => (prev === i ? null : i))}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                setPinned((prev) => (prev === i ? null : i));
              }
            }}
          />
        ))}
      </svg>

      <p className="mt-1 min-h-5 font-mono text-xs opacity-80">
        {active !== null ? (
          points[active].detail
        ) : (
          <span className="text-muted">
            {points.length === 1
              ? "one point logged — the line appears with the second"
              : trend === null
                ? "tap the chart for a session's numbers"
                : "tap the chart for a session's numbers · dashed = 8-week projection"}
          </span>
        )}
      </p>
    </div>
  );
}
