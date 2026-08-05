import { describe, expect, it } from "vitest";
import { seedSnapshot } from "./data/seed-snapshot";
import type { WeighIn } from "./types";
import { weighInChartPoints, weighInHistory, weighInTrend } from "./weigh-ins";

const data = seedSnapshot();

const wi = (id: string, date: string, bodyweightLbs: number): WeighIn => ({
  id,
  clientId: "nate",
  date,
  bodyweightLbs,
});

describe("weighInHistory", () => {
  it("returns one client's weigh-ins ascending by date", () => {
    const history = weighInHistory(data, "nate");
    expect(history.length).toBeGreaterThanOrEqual(3);
    expect(history.every((w) => w.clientId === "nate")).toBe(true);
    const dates = history.map((w) => w.date);
    expect(dates).toEqual([...dates].sort());
  });

  it("is empty for a client with no weigh-ins", () => {
    expect(weighInHistory(data, "nobody")).toEqual([]);
  });
});

describe("weighInTrend (seed-data integration)", () => {
  it("fits nate's slow gain with a positive slope", () => {
    const trend = weighInTrend(weighInHistory(data, "nate"));
    expect(trend).not.toBeNull();
    // 182 → 185 lb over ~12 weeks ≈ +0.25 lb/wk
    expect(trend!.slopePerWeek).toBeGreaterThan(0.1);
    expect(trend!.slopePerWeek).toBeLessThan(0.5);
    expect(trend!.segment.fromDate).toBe("2026-07-27");
    expect(trend!.segment.toDate).toBe("2026-09-21");
    expect(trend!.segment.toY).toBeGreaterThan(trend!.segment.fromY);
  });

  it("fits lidia's cut with a negative slope", () => {
    const trend = weighInTrend(weighInHistory(data, "lidia"));
    expect(trend).not.toBeNull();
    expect(trend!.slopePerWeek).toBeLessThan(0);
  });
});

describe("weighInTrend honesty guards", () => {
  it("needs at least 3 points", () => {
    expect(weighInTrend([])).toBeNull();
    expect(weighInTrend([wi("a", "2026-01-01", 180)])).toBeNull();
    expect(
      weighInTrend([wi("a", "2026-01-01", 180), wi("b", "2026-02-01", 181)]),
    ).toBeNull();
  });

  it("needs at least two weeks of spread", () => {
    const week = [
      wi("a", "2026-01-01", 180),
      wi("b", "2026-01-04", 181),
      wi("c", "2026-01-08", 182),
    ];
    expect(weighInTrend(week)).toBeNull();
  });

  it("only fits points inside the trailing window", () => {
    const history = [
      wi("old", "2020-01-01", 240),
      wi("a", "2026-01-01", 180),
      wi("b", "2026-01-15", 180),
    ];
    // the 2020 point falls out of the 90-day window, leaving only 2 points
    expect(weighInTrend(history)).toBeNull();
  });
});

describe("weighInChartPoints", () => {
  it("maps weigh-ins to chart points keyed by weigh-in id", () => {
    const points = weighInChartPoints([wi("wi_x", "2026-03-05", 181.5)]);
    expect(points).toEqual([
      {
        date: "2026-03-05",
        y: 181.5,
        sessionId: "wi_x",
        detail: "2026-03-05 · 181.5 lb",
      },
    ]);
  });
});
