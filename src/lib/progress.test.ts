import { describe, expect, it } from "vitest";
import { seedSnapshot } from "./data/seed-snapshot";
import {
  e1rmTrend,
  exerciseHistory,
  liftFrequency,
  liftOverview,
  trendSegment,
  type ExerciseHistoryPoint,
} from "./progress";

const data = seedSnapshot();

function point(date: string, e1rm: number | null): ExerciseHistoryPoint {
  return {
    sessionId: `s_${date}`,
    date,
    bestE1rmLbs: e1rm,
    topSet: e1rm === null ? null : { weightLbs: e1rm, reps: 1 },
    setCount: 3,
    volumeLbs: 1000,
  };
}

describe("e1rmTrend guards", () => {
  it("null on empty / too few / narrow-spread windows", () => {
    expect(e1rmTrend([])).toBeNull();
    expect(e1rmTrend([point("2026-07-01", 200), point("2026-07-20", 205)])).toBeNull();
    // 3 points but only 10 days of spread
    expect(
      e1rmTrend([point("2026-07-01", 200), point("2026-07-05", 202), point("2026-07-11", 204)]),
    ).toBeNull();
    // all-null e1RMs (ordinal-only)
    expect(
      e1rmTrend([point("2026-06-01", null), point("2026-06-20", null), point("2026-07-10", null)]),
    ).toBeNull();
  });

  it("fits a perfect line exactly (r²=1, slope in lb/week)", () => {
    // +1 lb/day for 28 days
    const history = [0, 7, 14, 28].map((d) =>
      point(`2026-06-${String(d + 1).padStart(2, "0")}`, 200 + d),
    );
    const trend = e1rmTrend(history)!;
    expect(trend.slopePerWeek).toBeCloseTo(7, 6);
    expect(trend.r2).toBeCloseTo(1, 6);
    expect(trend.fittedLastLbs).toBeCloseTo(228, 6);
    expect(trend.projected4wkLbs).toBeCloseTo(228 + 28, 6);
    expect(trend.projected8wkLbs).toBeCloseTo(228 + 56, 6);
  });

  it("flat data has slope 0 and r²=1 by convention", () => {
    const history = [1, 10, 20].map((d) =>
      point(`2026-06-${String(d).padStart(2, "0")}`, 200),
    );
    const trend = e1rmTrend(history)!;
    expect(trend.slopePerWeek).toBeCloseTo(0, 6);
    expect(trend.r2).toBe(1);
  });

  it("clamps steep declines at zero, never negative", () => {
    const history = [1, 10, 20].map((d, i) =>
      point(`2026-06-${String(d).padStart(2, "0")}`, 100 - i * 45),
    );
    const trend = e1rmTrend(history)!;
    expect(trend.slopePerWeek).toBeLessThan(0);
    expect(trend.projected8wkLbs).toBe(0);
  });

  it("trendSegment endpoints match the fit and projections", () => {
    const history = [0, 7, 14, 28].map((d) =>
      point(`2026-06-${String(d + 1).padStart(2, "0")}`, 200 + d),
    );
    const trend = e1rmTrend(history)!;
    const seg = trendSegment(trend);
    expect(seg.fromDate).toBe(trend.windowTo);
    expect(seg.fromY).toBeCloseTo(trend.fittedLastLbs, 6);
    expect(seg.toY).toBeCloseTo(trend.projected8wkLbs, 6);
    // +56 days in UTC
    expect(seg.toDate).toBe("2026-08-24");
  });
});

describe("seed-data integration", () => {
  it("exerciseHistory is ascending and per-session", () => {
    const history = exerciseHistory(data, "nate", "bench_press", "barbell");
    expect(history.length).toBeGreaterThan(2);
    const dates = history.map((p) => p.date);
    expect([...dates].sort()).toEqual(dates);
    expect(new Set(history.map((p) => p.sessionId)).size).toBe(history.length);
  });

  it("liftFrequency counts distinct completed sessions", () => {
    const rows = liftFrequency(data, "nate");
    const bench = rows.find((r) => r.exerciseId === "bench_press" && r.modalityId === "barbell");
    expect(bench).toBeDefined();
    expect(bench!.sessionCount).toBe(
      exerciseHistory(data, "nate", "bench_press", "barbell").length,
    );
  });

  it("liftOverview filters mobility work that liftFrequency keeps", () => {
    // Lidia's 2026-07-27 session logs a completed 300s stretch hold.
    const frequency = liftFrequency(data, "lidia");
    expect(frequency.some((r) => r.exerciseId === "stretch")).toBe(true);

    const overview = liftOverview(data, "lidia");
    expect(overview.some((r) => r.exerciseId === "stretch")).toBe(false);
    expect(overview.some((r) => r.exerciseId === "squat")).toBe(true);
  });
});
