import { describe, expect, it } from "vitest";
import { buildGymData } from "./gym-data";
import { seedSnapshot } from "./data/seed-snapshot";
import { hmmss, parseDuration } from "./periods";
import { kindFromStrava, paceLabel, runFromActivity, runWeek, weeklyMiles } from "./running";
import type { Run } from "./types";

const run = (o: Partial<Run>): Run => ({
  id: "run_x",
  clientId: "nate",
  date: "2026-11-07",
  distanceMiles: 7,
  durationSeconds: 7 * 560,
  kind: "easy",
  avgHeartRate: null,
  elevationGainFt: null,
  name: "",
  source: "manual",
  externalId: null,
  notes: "",
  ...o,
});

describe("pace and durations", () => {
  it("formats pace per mile", () => {
    expect(paceLabel(run({}))).toBe("9:20 /mi");
    expect(paceLabel(run({ distanceMiles: 4.5, durationSeconds: 4.5 * 570 }))).toBe("9:30 /mi");
  });

  it("parses typed durations", () => {
    expect(parseDuration("42:07")).toBe(42 * 60 + 7);
    expect(parseDuration("1:05:20")).toBe(3920);
    expect(parseDuration("45")).toBe(2700);
    expect(parseDuration("4:75")).toBeNull();
    expect(parseDuration("abc")).toBeNull();
    expect(parseDuration("")).toBeNull();
  });

  it("formats moving time", () => {
    expect(hmmss(3920)).toBe("1:05:20");
    expect(hmmss(2527)).toBe("42:07");
  });

  it("maps Strava workout types", () => {
    expect(kindFromStrava(2)).toBe("long");
    expect(kindFromStrava(null)).toBe("easy");
  });
});

describe("weekly tallies", () => {
  const data = buildGymData({
    ...seedSnapshot(),
    runsSource: "database",
    runs: [
      run({ id: "a", date: "2026-11-03", distanceMiles: 5 }), // Tue
      run({ id: "b", date: "2026-11-05", distanceMiles: 4.5 }), // Thu
      run({ id: "c", date: "2026-11-07", distanceMiles: 7, kind: "long" }), // Sat
      run({ id: "d", date: "2026-11-02", distanceMiles: 3, clientId: "lidia" }),
      run({ id: "e", date: "2026-10-31", distanceMiles: 6 }), // previous week
    ],
  });

  it("counts Monday through Sunday for one person", () => {
    const week = runWeek(data, "nate", "2026-11-08");
    expect(week.weekStart).toBe("2026-11-02");
    expect(week.runs.map((r) => r.id)).toEqual(["c", "b", "a"]);
    expect(week.miles).toBeCloseTo(16.5);
  });

  it("lists weekly mileage oldest first", () => {
    const weeks = weeklyMiles(data, "nate", "2026-11-07", 2);
    expect(weeks).toEqual([
      { weekStart: "2026-10-26", miles: 6 },
      { weekStart: "2026-11-02", miles: 16.5 },
    ]);
  });
});

describe("runFromActivity", () => {
  it("maps a Garmin run synced through Strava", () => {
    const out = runFromActivity(
      {
        id: 12345,
        name: "Morning Run",
        sport_type: "Run",
        distance: 11265.4, // 7.0 mi
        moving_time: 3920,
        total_elevation_gain: 30.5,
        start_date_local: "2026-11-07T07:12:00Z",
        average_heartrate: 151.6,
        workout_type: 2,
      },
      "nate",
    );
    expect(out).toMatchObject({
      date: "2026-11-07",
      distanceMiles: 7,
      durationSeconds: 3920,
      kind: "long",
      avgHeartRate: 152,
      elevationGainFt: 100,
      externalId: "strava:12345",
      source: "strava",
    });
  });
});
