import { describe, expect, it } from "vitest";
import {
  bikePast,
  bumpTarget,
  conditioningPieceDates,
  conditioningSummaries,
  conditioningTarget,
  EMPTY_CONDITIONING,
  formatIntervalScheme,
  lastComparable,
  lastRideLabel,
  milesToFeet,
  parseIntervalScheme,
  pieceLabel,
  pieceSeconds,
  readoutLabel,
  schemeSeconds,
  targetLabel,
  targetResult,
  vsLastLabel,
  warmupFitnessLine,
  warmupSummary,
} from "./conditioning";
import { seedSnapshot } from "./data/seed-snapshot";
import { buildGymData } from "./gym-data";
import { effectiveScores, setLoad } from "./modality";
import { liftOverview } from "./progress";
import { sessionVolumeLbs } from "./queries";
import { cardioWeekLine } from "./running";
import { compactSet, rxLabel } from "./session-labels";
import type { ConditioningLog, RoutineExercise, Session, SetLog } from "./types";
import { warmupPlan } from "./warmup";

const seed = seedSnapshot();

function session(id: string, date: string, clientId = "nate"): Session {
  return {
    id,
    clientId,
    date,
    assignmentId: null,
    routineId: null,
    durationMinutes: null,
    rpe: null,
    condition: null,
    status: "completed",
    notes: "",
  };
}

function piece(id: string, sessionId: string, log: Partial<ConditioningLog>, extra: Partial<SetLog> = {}): SetLog {
  return {
    id,
    sessionId,
    exerciseId: "echo_bike",
    modalityId: "cardio",
    position: 1,
    setNumber: 1,
    unilateralMode: "bilateral",
    side: null,
    reps: null,
    weightLbs: null,
    addedWeightLbs: null,
    bandId: null,
    bandRole: null,
    durationSeconds: 240,
    distanceFeet: null,
    rir: null,
    isWarmup: false,
    completed: true,
    notes: "",
    conditioning: { ...EMPTY_CONDITIONING, intervalScheme: "8x20/10", ...log },
    ...extra,
  };
}

/** Seed data plus a few bike sessions, dates in order. */
function withPieces(pieces: { date: string; log: Partial<ConditioningLog>; extra?: Partial<SetLog> }[]) {
  const sessions = pieces.map((p, i) => session(`s_bike_${i}`, p.date));
  const sets = pieces.map((p, i) => piece(`sl_bike_${i}`, `s_bike_${i}`, p.log, p.extra));
  return buildGymData({ ...seed, sessions: [...seed.sessions, ...sessions], setLogs: [...seed.setLogs, ...sets] });
}

const ROW = { intervalScheme: "8x20/10", targetWatts: 200, targetRpm: null };
/** A steady row — the only kind whose target can be checked, so the only
 *  kind that steps up by itself. */
const STEADY_ROW = { intervalScheme: null, targetWatts: null, targetRpm: 55 };

describe("interval schemes", () => {
  it("parses and formats the console presets", () => {
    expect(parseIntervalScheme("8x20/10")).toEqual({ rounds: 8, workSeconds: 20, restSeconds: 10 });
    expect(formatIntervalScheme({ rounds: 8, workSeconds: 10, restSeconds: 20 })).toBe("8x10/20");
    expect(schemeSeconds(parseIntervalScheme("8x20/10")!)).toBe(240);
  });
  it("rejects anything else", () => {
    for (const bad of [null, "", "8x20", "0x20/10", "8x0/10", "8 x 20/10", "100x20/10"]) {
      expect(parseIntervalScheme(bad)).toBeNull();
    }
  });
  it("a piece runs the scheme's length, else the row's, else 5:00", () => {
    expect(pieceSeconds({ conditioning: ROW, durationSeconds: 999 })).toBe(240);
    expect(pieceSeconds({ conditioning: null, durationSeconds: 600 })).toBe(600);
    expect(pieceSeconds({ conditioning: null, durationSeconds: null })).toBe(300);
  });
});

describe("labels", () => {
  it("piece, target and readout", () => {
    expect(pieceLabel("8x20/10", 240)).toBe("8 × 20/10");
    expect(pieceLabel(null, 300)).toBe("5:00 steady");
    expect(targetLabel({ intervalScheme: null, targetWatts: 200, targetRpm: 70 })).toBe("200 W · 70 rpm");
    expect(targetLabel({ intervalScheme: null, targetWatts: null, targetRpm: null })).toBeNull();
    expect(
      readoutLabel({ ...EMPTY_CONDITIONING, avgWatts: 182, maxWatts: 410, avgRpm: 64, calories: 38 }, milesToFeet(0.9)),
    ).toBe("182 W avg (410 max) · 64 rpm · 0.90 mi · 38 cal");
  });
  it("history chip shows the readout, or the target before anything is entered", () => {
    expect(compactSet(piece("a", "s", { targetRpm: 55 }))).toBe("8 × 20/10 · target 55 rpm");
    expect(compactSet(piece("a", "s", { targetRpm: 55, avgRpm: 58 }))).toBe("8 × 20/10 · 58 rpm");
  });
  it("routine row label", () => {
    const rx = { sets: 1, durationSeconds: null, restSeconds: 60, conditioning: ROW } as RoutineExercise;
    expect(rxLabel(rx)).toBe("8 × 20/10 @ 200 W · rest 60s");
    const steady = { sets: 1, durationSeconds: 300, restSeconds: 60, conditioning: null } as RoutineExercise;
    expect(rxLabel(steady, true)).toBe("5:00 steady · rest 60s");
  });
});

describe("targetResult", () => {
  const log = (l: Partial<ConditioningLog>) => ({ ...EMPTY_CONDITIONING, ...l });
  it("compares each target that has a reading", () => {
    expect(targetResult(log({ targetWatts: 200, avgWatts: 205 }))).toBe("met");
    expect(targetResult(log({ targetWatts: 200, avgWatts: 190 }))).toBe("below");
    expect(targetResult(log({ targetRpm: 55, avgRpm: 65 }))).toBe("well_above");
    expect(targetResult(log({ targetWatts: 200, avgWatts: 210, targetRpm: 70, avgRpm: 60 }))).toBe("below");
  });
  it("nothing comparable → null", () => {
    expect(targetResult(log({ targetWatts: 200 }))).toBeNull();
    expect(targetResult(log({ avgWatts: 200 }))).toBeNull();
  });
  it("never judges an interval piece: its target is for the work bouts, the average runs through the rests", () => {
    expect(targetResult(log({ intervalScheme: "8x20/10", targetWatts: 200, avgWatts: 169 }))).toBeNull();
    expect(targetResult(log({ intervalScheme: "10x30/30", targetWatts: 200, avgWatts: 260 }))).toBeNull();
  });
});

describe("bumpTarget", () => {
  it("watts +5% rounded to 5 (at least +5), rpm +2", () => {
    expect(bumpTarget(ROW).targetWatts).toBe(210);
    expect(bumpTarget({ ...ROW, targetWatts: 60 }).targetWatts).toBe(65);
    expect(bumpTarget({ ...ROW, targetWatts: null, targetRpm: 55 })).toMatchObject({ targetWatts: null, targetRpm: 57 });
  });
});

describe("conditioningTarget", () => {
  it("no history: the row's target", () => {
    expect(conditioningTarget(seed, "nate", "echo_bike", ROW)).toEqual(ROW);
  });

  it("their own last target wins over the row's", () => {
    const data = withPieces([{ date: "2026-11-10", log: { targetWatts: null, targetRpm: 55, avgRpm: 50 } }]);
    expect(conditioningTarget(data, "nate", "echo_bike", ROW)).toEqual({
      intervalScheme: "8x20/10",
      targetWatts: null,
      targetRpm: 55,
    });
  });

  it("only the same scheme counts for a routine row", () => {
    const data = withPieces([{ date: "2026-11-10", log: { intervalScheme: null, targetWatts: 150 } }]);
    expect(conditioningTarget(data, "nate", "echo_bike", ROW)).toEqual(ROW);
  });

  it("a steady target met twice in a row → bumped once", () => {
    const data = withPieces([
      { date: "2026-11-10", log: { intervalScheme: null, targetRpm: 55, avgRpm: 56 } },
      { date: "2026-11-12", log: { intervalScheme: null, targetRpm: 55, avgRpm: 58 } },
    ]);
    expect(conditioningTarget(data, "nate", "echo_bike", STEADY_ROW).targetRpm).toBe(57);
  });

  it("an interval target never bumps itself — it carries over until raised by hand", () => {
    const data = withPieces([
      { date: "2026-11-10", log: { targetWatts: 200, avgWatts: 230 } },
      { date: "2026-11-12", log: { targetWatts: 200, avgWatts: 240 } },
    ]);
    expect(conditioningTarget(data, "nate", "echo_bike", ROW).targetWatts).toBe(200);
  });

  it("a miss, or a target change in between, holds it", () => {
    const missed = withPieces([
      { date: "2026-11-10", log: { intervalScheme: null, targetRpm: 55, avgRpm: 50 } },
      { date: "2026-11-12", log: { intervalScheme: null, targetRpm: 55, avgRpm: 58 } },
    ]);
    expect(conditioningTarget(missed, "nate", "echo_bike", STEADY_ROW).targetRpm).toBe(55);
    const changed = withPieces([
      { date: "2026-11-10", log: { intervalScheme: null, targetRpm: 55, avgRpm: 56 } },
      { date: "2026-11-12", log: { intervalScheme: null, targetRpm: 57, avgRpm: 58 } },
    ]);
    expect(conditioningTarget(changed, "nate", "echo_bike", STEADY_ROW).targetRpm).toBe(57);
  });

  it("ignores other people, warm-ups and pieces never logged", () => {
    const data = withPieces([
      { date: "2026-11-10", log: { targetWatts: 120 }, extra: { isWarmup: true } },
      { date: "2026-11-11", log: { targetWatts: 130 }, extra: { completed: false } },
    ]);
    expect(conditioningTarget(data, "nate", "echo_bike", ROW)).toEqual(ROW);
    expect(conditioningTarget(withPieces([{ date: "2026-11-10", log: { targetWatts: 120 } }]), "lidia", "echo_bike", ROW)).toEqual(ROW);
  });

  it("lists every piece's date, newest first, warm-ups excluded", () => {
    const data = withPieces([
      { date: "2026-11-09", log: {} },
      { date: "2026-11-16", log: {} },
      { date: "2026-11-17", log: {}, extra: { isWarmup: true } },
      { date: "2026-11-18", log: {} },
    ]);
    expect(conditioningPieceDates(data, "nate")).toEqual(["2026-11-18", "2026-11-16", "2026-11-09"]);
  });

  it("cardioWeekLine: this week's bike pieces; 'nothing yet' for older bike-only history", () => {
    const data = withPieces([
      { date: "2026-11-09", log: {} },
      { date: "2026-11-16", log: {} },
      { date: "2026-11-18", log: {} },
    ]);
    expect(cardioWeekLine(data, "nate", "2026-11-18")).toBe("2 bike pieces");
    // Bike-only, nothing this week — still links to Cardio.
    expect(cardioWeekLine(data, "nate", "2026-12-01")).toBe("nothing yet");
    expect(cardioWeekLine(data, "lidia", "2026-11-18")).toBeNull();
  });

  it("bike warm-ups never show up in the Echo Bike history", () => {
    const data = withPieces([
      { date: "2026-11-10", log: { intervalScheme: null, avgWatts: 90 }, extra: { isWarmup: true } },
    ]);
    expect(conditioningSummaries(data, "nate")).toEqual(conditioningSummaries(seed, "nate"));
  });

  it("added mid-session (no row): their last piece of any scheme, scheme included", () => {
    const data = withPieces([{ date: "2026-11-10", log: { intervalScheme: null, targetWatts: 150 } }]);
    expect(conditioningTarget(data, "nate", "echo_bike")).toEqual({
      intervalScheme: null,
      targetWatts: 150,
      targetRpm: null,
    });
  });
});

describe("kept out of strength math", () => {
  const data = withPieces([{ date: "2026-11-10", log: { targetWatts: 200, avgWatts: 210 } }]);
  const bike = data.setLogs.find((s) => s.exerciseId === "echo_bike")!;

  it("no pounds, no volume, no muscle scores, not a lift", () => {
    expect(setLoad(data, bike).lbs).toBeNull();
    expect(sessionVolumeLbs(data, bike.sessionId)).toBe(0);
    expect(effectiveScores(data, "echo_bike", "cardio").size).toBe(0);
    expect(liftOverview(data, "nate").some((row) => row.exerciseId === "echo_bike")).toBe(false);
  });

  it("shows up in the conditioning summary instead", () => {
    const [summary] = conditioningSummaries(data, "nate");
    expect(summary.exerciseId).toBe("echo_bike");
    expect(summary.points.map((p) => p.y)).toEqual([210]);
    // An interval piece is never judged against its work-bout target.
    expect(summary.recent[0]).toMatchObject({ piece: "8 × 20/10", target: "200 W", result: null });
    expect(conditioningSummaries(data, "lidia")).toEqual([]);
  });
});

describe("bump rule never mixes schemes (no routine row)", () => {
  it("a steady piece and a 20/10 at the same watts don't count as two hits", () => {
    const data = withPieces([
      { date: "2026-11-10", log: { intervalScheme: null, targetWatts: 200, avgWatts: 210 } },
      { date: "2026-11-12", log: { intervalScheme: "8x20/10", targetWatts: 200, avgWatts: 210 } },
    ]);
    expect(conditioningTarget(data, "nate", "echo_bike").targetWatts).toBe(200);
  });
});

describe("bike warm-ups roll forward per person (warmupPlan)", () => {
  const warm = (date: string, log: Partial<ConditioningLog>, extra: Partial<SetLog> = {}) => ({
    date,
    log,
    extra: { isWarmup: true, ...extra },
  });

  it("first warm-up: the 20/10 preset (4:00), no target", () => {
    expect(warmupPlan(seed, "nate")).toEqual({
      target: { intervalScheme: "8x20/10", targetWatts: null, targetRpm: null },
      durationSeconds: 240,
    });
  });

  it("carries the last warm-up's piece and target", () => {
    const data = withPieces([warm("2026-11-18", { targetWatts: 250, avgWatts: 240 })]);
    expect(warmupPlan(data, "nate")).toEqual({
      target: { intervalScheme: "8x20/10", targetWatts: 250, targetRpm: null },
      durationSeconds: 240,
    });
  });

  it("a steady warm-up hit twice in a row at the target → bumped once", () => {
    const data = withPieces([
      warm("2026-11-16", { intervalScheme: null, targetWatts: 120, avgWatts: 121 }),
      warm("2026-11-18", { intervalScheme: null, targetWatts: 120, avgWatts: 125 }),
    ]);
    expect(warmupPlan(data, "lidia").target.targetWatts).toBeNull(); // someone else's history
    expect(warmupPlan(data, "nate").target.targetWatts).toBe(125); // +5%, rounded to 5
  });

  it("a 20/10 warm-up's target just carries over", () => {
    const data = withPieces([
      warm("2026-11-16", { targetWatts: 120, avgWatts: 121 }),
      warm("2026-11-18", { targetWatts: 120, avgWatts: 125 }),
    ]);
    expect(warmupPlan(data, "nate").target.targetWatts).toBe(120);
  });

  it("a steady warm-up stays steady at its length", () => {
    const data = withPieces([warm("2026-11-18", { intervalScheme: null, targetWatts: 100 }, { durationSeconds: 300 })]);
    expect(warmupPlan(data, "nate")).toEqual({
      target: { intervalScheme: null, targetWatts: 100, targetRpm: null },
      durationSeconds: 300,
    });
  });

  it("ignores finisher pieces and unlogged warm-ups", () => {
    const data = withPieces([
      { date: "2026-11-16", log: { targetWatts: 300, avgWatts: 310 } },
      warm("2026-11-18", { targetWatts: 140 }, { completed: false }),
    ]);
    expect(warmupPlan(data, "nate").target.targetWatts).toBeNull();
  });
});

describe("warm-up progress (warmupSummary)", () => {
  const warm = (date: string, log: Partial<ConditioningLog>, extra: Partial<SetLog> = {}) => ({
    date,
    log,
    extra: { isWarmup: true, ...extra },
  });

  it("none logged → no series; finisher summaries are unaffected by warm-ups", () => {
    expect(warmupSummary(seed, "nate", "echo_bike")).toBeNull();
  });

  it("charts only the newest piece's shape; lists every warm-up with effort", () => {
    const data = withPieces([
      warm("2026-11-02", { intervalScheme: null, avgWatts: 90 }, { durationSeconds: 300 }),
      warm("2026-11-11", { avgWatts: 250 }),
      warm("2026-11-18", { avgWatts: 271, effort: 5 }),
    ]);
    const s = warmupSummary(data, "nate", "echo_bike")!;
    expect(s.key).toBe("echo_bike:warmup");
    expect(s.name).toBe("Warm-up · 8 × 20/10");
    expect(s.points.map((p) => [p.date, p.y])).toEqual([
      ["2026-11-11", 250],
      ["2026-11-18", 271],
    ]);
    expect(s.recent.map((p) => [p.date, p.effort])).toEqual([
      ["2026-11-18", 5],
      ["2026-11-11", null],
      ["2026-11-02", null],
    ]);
  });
});

describe("warmupFitnessLine", () => {
  const p = (date: string, avgWatts: number | null, effort?: number | null) => ({
    date,
    log: { ...EMPTY_CONDITIONING, intervalScheme: "8x20/10", avgWatts, ...(effort !== undefined ? { effort } : {}) },
  });

  it("same effort 3–6 weeks apart → the watts difference", () => {
    expect(warmupFitnessLine([p("2026-12-16", 140, 5), p("2026-12-09", 135, 5), p("2026-11-18", 122, 5)])).toBe(
      "+18 W avg at effort 5 vs Nov 18",
    );
    expect(warmupFitnessLine([p("2026-12-16", 110, 5), p("2026-11-18", 122, 5)])).toBe("−12 W avg at effort 5 vs Nov 18");
  });

  it("no fair pair → null (different effort, too recent, too old, no effort logged)", () => {
    expect(warmupFitnessLine([p("2026-12-16", 140, 6), p("2026-11-18", 122, 5)])).toBeNull();
    expect(warmupFitnessLine([p("2026-12-01", 140, 5), p("2026-11-18", 122, 5)])).toBeNull();
    expect(warmupFitnessLine([p("2027-02-01", 140, 5), p("2026-11-18", 122, 5)])).toBeNull();
    expect(warmupFitnessLine([p("2026-12-16", 140), p("2026-11-18", 122)])).toBeNull();
    expect(warmupFitnessLine([])).toBeNull();
  });
});

describe("effort in labels", () => {
  it("shows on the set label only when picked", () => {
    const set = piece("sl", "s", { avgWatts: 116, effort: 4 });
    expect(compactSet(set)).toContain("effort 4");
    expect(compactSet(piece("sl", "s", { avgWatts: 116 }))).not.toContain("effort");
  });
});

describe("the live card's last ride (bikePast / lastComparable)", () => {
  const data = withPieces([
    { date: "2026-11-09", log: { avgWatts: 150, effort: 6 }, extra: { isWarmup: true } },
    { date: "2026-11-16", log: { avgWatts: 169, effort: 8 }, extra: { isWarmup: true } },
    { date: "2026-11-17", log: { intervalScheme: null, avgWatts: 110 }, extra: { isWarmup: true, durationSeconds: 300 } },
    { date: "2026-11-18", log: { avgWatts: 210 } },
    { date: "2026-11-19", log: { targetWatts: 200 } }, // logged without an average
    { date: "2026-11-20", log: { avgWatts: 300 }, extra: { completed: false } },
  ]);
  const history = bikePast(data, "nate");
  const set = (extra: Partial<SetLog> = {}, log: Partial<ConditioningLog> = {}) => piece("now", "s_now", log, extra);

  it("lists rides that have an average, newest first, and can leave a session out", () => {
    expect(history.map((p) => p.date)).toEqual(["2026-11-18", "2026-11-17", "2026-11-16", "2026-11-09"]);
    expect(bikePast(data, "nate", "s_bike_3").map((p) => p.date)).toEqual(["2026-11-17", "2026-11-16", "2026-11-09"]);
    expect(bikePast(data, "lidia")).toEqual([]);
  });

  it("compares like with like: same shape, warm-up with warm-up", () => {
    expect(lastComparable(history, set({ isWarmup: true }))).toMatchObject({ date: "2026-11-16", avgWatts: 169, effort: 8 });
    expect(lastComparable(history, set())).toMatchObject({ date: "2026-11-18", avgWatts: 210 });
    expect(lastComparable(history, set({ isWarmup: true, durationSeconds: 300 }, { intervalScheme: null }))).toMatchObject({
      date: "2026-11-17",
    });
    expect(lastComparable(history, set({}, { intervalScheme: "10x30/30" }))).toBeNull();
  });

  it("on a day of several pieces, piece 2 is held against last time's piece 2", () => {
    const day = buildGymData({
      ...seed,
      sessions: [...seed.sessions, session("s_day", "2026-11-18")],
      setLogs: [
        ...seed.setLogs,
        piece("d1", "s_day", { avgWatts: 220 }, { position: 1, setNumber: 1 }),
        piece("d2", "s_day", { avgWatts: 205 }, { position: 2, setNumber: 2 }),
        piece("d3", "s_day", { avgWatts: 190 }, { position: 3, setNumber: 3 }),
      ],
    });
    const past = bikePast(day, "nate");
    expect(lastComparable(past, set({ setNumber: 2 }))?.avgWatts).toBe(205);
    // A piece number last time didn't reach falls back to its newest piece.
    expect(lastComparable(past, set({ setNumber: 5 }))?.avgWatts).toBe(190);
  });

  it("labels: the last ride, and today against it in words", () => {
    const last = lastComparable(history, set({ isWarmup: true }))!;
    expect(lastRideLabel(last)).toBe("Last · Nov 16 · 169 W avg · effort 8");
    expect(lastRideLabel({ ...last, effort: null })).toBe("Last · Nov 16 · 169 W avg");
    expect(vsLastLabel(181, last)).toBe("+12 W vs Nov 16");
    expect(vsLastLabel(161, last)).toBe("−8 W vs Nov 16");
    expect(vsLastLabel(169, last)).toBe("same as Nov 16");
  });
});
