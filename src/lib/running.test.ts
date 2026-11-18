import { describe, expect, it } from "vitest";
import { buildGymData } from "./gym-data";
import { seedSnapshot } from "./data/seed-snapshot";
import { hmmss, parseDuration } from "./periods";
import {
  isGarminRun,
  isSameRun,
  kindFromStrava,
  planRunSync,
  runFromGarmin,
  paceLabel,
  runFromActivity,
  cardioWeekLine,
  runLog,
  runnerSummary,
  runWeek,
  weeklyMiles,
} from "./running";
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

  it("summarizes this week's tally and a 12-week chart", () => {
    const summary = runnerSummary(data, "nate", "2026-11-08", ["strava"]);
    expect(summary.weekRuns).toBe(3);
    expect(summary.weekMiles).toBe("16.5 mi");
    expect(summary.weekly).toHaveLength(12);
    expect(summary.weekly.at(-1)).toEqual({ label: "Nov 2", miles: 16.5 });
    expect(summary.syncSources).toEqual(["strava"]);
    expect(runnerSummary(data, "nate", "2026-11-08", [], 6).weekly).toHaveLength(6);
  });

  it("runLog: every run by Monday-week, newest first, with week totals", () => {
    const log = runLog(data, "nate", "2026-11-17");
    expect(log.map((w) => [w.weekStart, w.label, w.miles, w.runs.map((r) => r.id)])).toEqual([
      ["2026-11-02", "Week of Nov 2", "16.5 mi", ["c", "b", "a"]],
      ["2026-10-26", "Week of Oct 26", "6.0 mi", ["e"]],
    ]);
    expect(log[0].runs[0]).toMatchObject({ dayLabel: "Sat Nov 7", kindLabel: "Long", miles: "7.0 mi" });
    expect(runLog(data, "gabriel", "2026-11-17")).toEqual([]);
  });

  it("runLog: last year's runs carry their year", () => {
    const log = runLog(data, "nate", "2027-01-05");
    expect(log[0].label).toBe("Week of Nov 2, 2026");
    expect(log[0].runs[0].dayLabel).toBe("Sat Nov 7, 2026");
  });

  it("cardioWeekLine: this week's runs, 'nothing yet' on a quiet week, null with no cardio", () => {
    expect(cardioWeekLine(data, "nate", "2026-11-08")).toBe("3 runs · 16.5 mi");
    expect(cardioWeekLine(data, "nate", "2026-11-12")).toBe("nothing yet");
    expect(cardioWeekLine(data, "gabriel", "2026-11-08")).toBeNull();
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

describe("Garmin import", () => {
  const activity = {
    activityId: 123,
    activityName: "Morning Run",
    startTimeLocal: "2026-11-14 07:05:00",
    activityType: { typeKey: "trail_running" },
    distance: 8046.72,
    duration: 2900,
    movingDuration: 2820.4,
    elevationGain: 50,
    averageHR: 151.6,
  };

  it("keeps running types with distance and time; drops the rest", () => {
    expect(isGarminRun(activity)).toBe(true);
    expect(isGarminRun({ ...activity, activityType: { typeKey: "treadmill_running" } })).toBe(true);
    expect(isGarminRun({ ...activity, activityType: { typeKey: "cycling" } })).toBe(false);
    expect(isGarminRun({ ...activity, distance: 0 })).toBe(false);
    expect(isGarminRun({ ...activity, activityType: undefined })).toBe(false);
  });

  it("maps to a run: local date, moving time, miles, garmin external id", () => {
    expect(runFromGarmin(activity, "nate")).toMatchObject({
      date: "2026-11-14",
      distanceMiles: 5,
      durationSeconds: 2820,
      avgHeartRate: 152,
      elevationGainFt: 164,
      source: "garmin",
      externalId: "garmin:123",
      kind: "easy",
    });
    expect(runFromGarmin({ ...activity, movingDuration: undefined }, "nate").durationSeconds).toBe(2900);
  });
});

describe("cross-source dedupe", () => {
  const base = { date: "2026-11-14", distanceMiles: 5, durationSeconds: 2820 };

  it("isSameRun tolerates watch-vs-app rounding only", () => {
    expect(isSameRun(base, { ...base, distanceMiles: 5.08, durationSeconds: 2870 })).toBe(true);
    expect(isSameRun(base, { ...base, distanceMiles: 5.2 })).toBe(false);
    expect(isSameRun(base, { ...base, durationSeconds: 2950 })).toBe(false);
    expect(isSameRun(base, { ...base, date: "2026-11-15" })).toBe(false);
  });

  it("planRunSync: refresh known, skip other-source twins, insert the rest", () => {
    const run = (externalId: string, over = {}) => ({
      clientId: "nate",
      kind: "easy" as const,
      avgHeartRate: null,
      elevationGainFt: null,
      name: "",
      source: "garmin" as const,
      externalId,
      notes: "",
      ...base,
      ...over,
    });
    const plan = planRunSync(
      [run("garmin:1"), run("garmin:2"), run("garmin:3", { date: "2026-11-15" })],
      new Map([["garmin:1", "run_a"]]),
      [{ ...base, source: "strava" }],
    );
    expect(plan.known.map((k) => k.id)).toEqual(["run_a"]);
    expect(plan.duplicates).toBe(1);
    expect(plan.fresh.map((r) => r.externalId)).toEqual(["garmin:3"]);
  });

  it("never treats a same-source run as a twin", () => {
    const plan = planRunSync(
      [{ ...base, clientId: "nate", kind: "easy", avgHeartRate: null, elevationGainFt: null, name: "", source: "garmin", externalId: "garmin:9", notes: "" }],
      new Map(),
      [{ ...base, source: "garmin" }],
    );
    expect(plan.fresh).toHaveLength(1);
  });
});
