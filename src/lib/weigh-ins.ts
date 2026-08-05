import type { ChartPoint, TrendSegment } from "@/components/progress-chart";
import type { GymData } from "./gym-data";
import { addDaysIso, utcDay } from "./periods";
import type { ClientId, WeighIn } from "./types";

/**
 * Bodyweight-over-time queries for the Users page. Pure and synchronous over
 * `GymData`, like progress.ts. The trend is a deliberately separate ~20-line
 * least-squares rather than a generalization of `e1rmTrend` — that function is
 * typed to lift history and feeds the Progress tiles; sharing it would couple
 * two charts that only coincidentally fit the same line.
 */

/** One client's weigh-ins, ascending by date (tie-break id) — chart order. */
export function weighInHistory(data: GymData, clientId: ClientId): WeighIn[] {
  return data.weighIns
    .filter((w) => w.clientId === clientId)
    .sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
}

export type WeighInTrend = {
  slopePerWeek: number;
  /** Fitted endpoints for the chart's dashed 8-week projection. */
  segment: TrendSegment;
};

/**
 * Least-squares fit over the trailing window, with the same honesty guards as
 * `e1rmTrend`: null when fewer than 3 points in the window or they span less
 * than two weeks — extrapolating a scale-hop two months out is noise.
 */
export function weighInTrend(
  history: readonly WeighIn[],
  opts: { days?: number } = {},
): WeighInTrend | null {
  if (history.length === 0) return null;
  const days = opts.days ?? 90;
  const last = history[history.length - 1];
  const cutoff = utcDay(last.date) - days;
  const window = history.filter((w) => utcDay(w.date) >= cutoff);
  if (window.length < 3) return null;

  const x0 = utcDay(window[0].date);
  const xs = window.map((w) => utcDay(w.date) - x0);
  const ys = window.map((w) => w.bodyweightLbs);
  const spread = xs[xs.length - 1] - xs[0];
  if (spread < 14) return null;

  const n = xs.length;
  const xMean = xs.reduce((a, b) => a + b, 0) / n;
  const yMean = ys.reduce((a, b) => a + b, 0) / n;
  let sxy = 0;
  let sxx = 0;
  for (let i = 0; i < n; i++) {
    sxy += (xs[i] - xMean) * (ys[i] - yMean);
    sxx += (xs[i] - xMean) ** 2;
  }
  if (sxx === 0) return null;
  const slope = sxy / sxx;
  const intercept = yMean - slope * xMean;
  const xLast = xs[xs.length - 1];

  return {
    slopePerWeek: slope * 7,
    segment: {
      fromDate: last.date,
      fromY: Math.max(0, intercept + slope * xLast),
      toDate: addDaysIso(last.date, 56),
      toY: Math.max(0, intercept + slope * (xLast + 56)),
    },
  };
}

/** Weigh-ins as chart points. `sessionId` is the chart's React key slot —
 *  weigh-in ids go there. */
export function weighInChartPoints(history: readonly WeighIn[]): ChartPoint[] {
  return history.map((w) => ({
    date: w.date,
    y: w.bodyweightLbs,
    sessionId: w.id,
    detail: `${w.date} · ${w.bodyweightLbs} lb`,
  }));
}
