import { describe, expect, it } from "vitest";
import { seedSnapshot } from "./data/seed-snapshot";
import { buildGymData } from "./gym-data";
import { addDaysIso } from "./periods";
import {
  doubleProgression,
  type Exposure,
  improves,
  MAX_GAP_DAYS,
  STALL_DAYS,
  STALL_EXPOSURES,
  stallFor,
  variantExposures,
} from "./progression";
import type { ModalityId, Session, SetLog } from "./types";

const seed = seedSnapshot();

/** One logged session: [load, reps] per set (bodyweight load = added lbs). */
type Day = { date: string; sets: [number, number][] };

function set(
  sessionId: string,
  i: number,
  exerciseId: string,
  modalityId: ModalityId,
  [load, reps]: [number, number],
): SetLog {
  return {
    id: `sl_${sessionId}_${i}`,
    sessionId,
    exerciseId,
    modalityId,
    position: i + 1,
    setNumber: i + 1,
    unilateralMode: "bilateral",
    side: null,
    reps,
    weightLbs: modalityId === "bodyweight" ? null : load,
    addedWeightLbs: modalityId === "bodyweight" && load > 0 ? load : null,
    bandId: null,
    bandRole: null,
    durationSeconds: null,
    distanceFeet: null,
    rir: 1,
    isWarmup: false,
    completed: true,
    notes: "",
    conditioning: null,
  };
}

/** Seed data plus Gabriel's sessions of one variant (he has none of these). */
function withHistory(days: Day[], exerciseId = "deadlift", modalityId: ModalityId = "barbell") {
  const sessions: Session[] = days.map((d, i) => ({
    id: `s_prog_${i}`,
    clientId: "gabriel",
    date: d.date,
    assignmentId: null,
    routineId: null,
    durationMinutes: null,
    rpe: null,
    condition: null,
    status: "completed",
    notes: "",
  }));
  const sets = days.flatMap((d, i) => d.sets.map((s, j) => set(`s_prog_${i}`, j, exerciseId, modalityId, s)));
  return buildGymData({ ...seed, sessions: [...seed.sessions, ...sessions], setLogs: [...seed.setLogs, ...sets] });
}

const DEADLIFT = { exerciseId: "deadlift", modalityId: "barbell" as const };
const RX = { repMin: 3, repMax: 5 };
const flat = (date: string, reps = [5, 5, 4]): Day => ({ date, sets: reps.map((r) => [200, r] as [number, number]) });

describe("stallFor", () => {
  it("steady weekly progress is never a stall", () => {
    const data = withHistory([
      { date: "2026-10-20", sets: [[185, 5]] },
      { date: "2026-10-27", sets: [[190, 5]] },
      { date: "2026-11-03", sets: [[195, 5]] },
      { date: "2026-11-10", sets: [[200, 5]] },
    ]);
    expect(stallFor(data, "gabriel", DEADLIFT, RX, "2026-11-17")).toBeNull();
  });

  it("three weeks flat across two-plus sessions is a stall, dated from the last best", () => {
    const data = withHistory([flat("2026-10-20", [5, 5, 5]), flat("2026-10-27"), flat("2026-11-03", [5, 5, 5]), flat("2026-11-10", [5, 4, 4])]);
    expect(stallFor(data, "gabriel", DEADLIFT, RX, "2026-11-17")).toEqual({
      sinceDate: "2026-10-20",
      days: 28,
      exposures: 3,
      suggestion: { kind: "same_load", load: 200, targetReps: 5, lastReps: [5, 4, 4] },
    });
  });

  it(`needs ${STALL_EXPOSURES} sessions since the last best, and ${STALL_DAYS} days`, () => {
    const one = withHistory([flat("2026-10-20", [5, 5, 5]), flat("2026-11-10")]);
    expect(stallFor(one, "gabriel", DEADLIFT, RX, "2026-11-17")).toBeNull();
    const best = "2026-11-01";
    const recent = withHistory([flat(best, [5, 5, 5]), flat("2026-11-05"), flat("2026-11-09")]);
    expect(stallFor(recent, "gabriel", DEADLIFT, RX, addDaysIso(best, STALL_DAYS - 1))).toBeNull();
    expect(stallFor(recent, "gabriel", DEADLIFT, RX, addDaysIso(best, STALL_DAYS))).not.toBeNull();
  });

  it(`a break over ${MAX_GAP_DAYS} days restarts the streak; exactly ${MAX_GAP_DAYS} keeps it`, () => {
    const climbing: Day[] = [
      { date: "2026-10-27", sets: [[185, 5]] },
      { date: "2026-11-03", sets: [[190, 5]] },
      { date: "2026-11-10", sets: [[195, 5]] },
    ];
    const heavy = (date: string): Day => ({ date, sets: [[225, 5]] });
    const afterBreak = withHistory([heavy(addDaysIso("2026-10-27", -(MAX_GAP_DAYS + 1))), ...climbing]);
    expect(stallFor(afterBreak, "gabriel", DEADLIFT, RX, "2026-11-17")).toBeNull();
    const edge = addDaysIso("2026-10-27", -MAX_GAP_DAYS);
    const noBreak = withHistory([heavy(edge), ...climbing]);
    expect(stallFor(noBreak, "gabriel", DEADLIFT, RX, "2026-11-17")).toMatchObject({
      sinceDate: edge,
      exposures: 3,
    });
  });

  it("coming back from a break is never called out", () => {
    const data = withHistory([flat("2026-09-10", [5, 5, 5]), flat("2026-09-17"), flat("2026-09-24"), flat("2026-10-01")]);
    expect(stallFor(data, "gabriel", DEADLIFT, RX, "2026-10-14")).not.toBeNull();
    expect(stallFor(data, "gabriel", DEADLIFT, RX, "2026-10-16")).toBeNull();
  });

  it("ignores the session being run and anything after the check date", () => {
    const data = withHistory([flat("2026-10-20", [5, 5, 5]), flat("2026-10-27"), flat("2026-11-03"), flat("2026-11-10")]);
    expect(stallFor(data, "gabriel", DEADLIFT, RX, "2026-11-17", "s_prog_3")?.exposures).toBe(2);
    expect(stallFor(data, "gabriel", DEADLIFT, RX, "2026-11-05")).toBeNull();
  });

  it("bodyweight work stalls on reps alone; plain bodyweight suggests more reps", () => {
    const pullUps = (date: string): Day => ({ date, sets: [[0, 8], [0, 8], [0, 8]] });
    const data = withHistory(
      [pullUps("2026-10-20"), pullUps("2026-10-27"), pullUps("2026-11-03"), pullUps("2026-11-10")],
      "pull_up",
      "bodyweight",
    );
    const hint = stallFor(data, "gabriel", { exerciseId: "pull_up", modalityId: "bodyweight" }, { repMin: 6, repMax: 8 }, "2026-11-17");
    expect(hint?.suggestion).toEqual({ kind: "at_ceiling", load: 0, lastReps: [8, 8, 8] });
  });

  it("never for bands, cardio, timed holds or carries", () => {
    const data = withHistory([flat("2026-10-20"), flat("2026-10-27"), flat("2026-11-03"), flat("2026-11-10")]);
    expect(stallFor(data, "gabriel", { exerciseId: "deadlift", modalityId: "band" }, RX, "2026-11-17")).toBeNull();
    expect(stallFor(data, "gabriel", { exerciseId: "echo_bike", modalityId: "cardio" }, RX, "2026-11-17")).toBeNull();
    expect(stallFor(data, "gabriel", { exerciseId: "plank", modalityId: "bodyweight" }, RX, "2026-11-17")).toBeNull();
    expect(stallFor(data, "gabriel", { exerciseId: "farmer_carry", modalityId: "dumbbell" }, RX, "2026-11-17")).toBeNull();
  });
});

describe("improves", () => {
  const exp = (top: number, topReps: number[], e1rm: number | null = null): Exposure => ({
    sessionId: "s",
    date: "2026-11-01",
    sets: [],
    top,
    topReps,
    e1rm,
  });

  it("an e1RM gain counts only from +1%", () => {
    expect(improves(exp(205, [4], 100.9), exp(200, [5], 100))).toBe(false);
    expect(improves(exp(205, [4], 101), exp(200, [5], 100))).toBe(true);
  });

  it("heavier at the same reps, or more reps at the same load", () => {
    expect(improves(exp(205, [5]), exp(200, [5]))).toBe(true);
    expect(improves(exp(200, [6]), exp(200, [5]))).toBe(true);
    expect(improves(exp(195, [6]), exp(200, [5]))).toBe(false);
  });

  it("at the same top load, more total reps across the sets", () => {
    expect(improves(exp(100, [10, 10, 9]), exp(100, [10, 9, 8]))).toBe(true);
    expect(improves(exp(100, [10, 9, 8]), exp(100, [10, 10, 9]))).toBe(false);
    expect(improves(exp(100, [10, 9, 8]), exp(100, [10, 9, 8]))).toBe(false);
  });
});

describe("doubleProgression", () => {
  const sets = (modalityId: ModalityId, load: number, reps: number[]) =>
    reps.map((r, i) => set("s_x", i, "goblet_squat", modalityId, [load, r]));

  it("every set at the top of the range → next load step, reps reset", () => {
    expect(doubleProgression("dumbbell", sets("dumbbell", 25, [10, 10, 10]), { repMin: 8, repMax: 10 })).toEqual({
      kind: "add_load",
      load: 30,
      repMin: 8,
      repMax: 10,
    });
    expect(doubleProgression("barbell", sets("barbell", 145, [10, 10, 10]), { repMin: 8, repMax: 10 })).toMatchObject({
      kind: "add_load",
      load: 150,
    });
  });

  it("short of the top → same load, work the reps up", () => {
    expect(doubleProgression("barbell", sets("barbell", 145, [10, 9, 8]), { repMin: 8, repMax: 10 })).toEqual({
      kind: "same_load",
      load: 145,
      targetReps: 10,
      lastReps: [10, 9, 8],
    });
    // No prescription: one more rep than the best set.
    expect(doubleProgression("barbell", sets("barbell", 145, [8, 7]))).toMatchObject({ targetReps: 9 });
  });

  it("already on the heaviest pair → at ceiling; bands and empty → null", () => {
    expect(doubleProgression("dumbbell", sets("dumbbell", 50, [12, 12]), { repMin: 10, repMax: 12 })?.kind).toBe("at_ceiling");
    expect(doubleProgression("band", sets("band", 0, [12]), { repMin: 10, repMax: 12 })).toBeNull();
    expect(doubleProgression("barbell", [])).toBeNull();
  });
});

describe("variantExposures", () => {
  it("one per completed session, oldest first, top load and its reps", () => {
    const data = withHistory([
      { date: "2026-11-03", sets: [[185, 5], [205, 3], [205, 2]] },
      { date: "2026-10-27", sets: [[200, 5]] },
    ]);
    const exposures = variantExposures(data, "gabriel", DEADLIFT, "2026-11-17");
    expect(exposures.map((e) => [e.date, e.top, e.topReps])).toEqual([
      ["2026-10-27", 200, [5]],
      ["2026-11-03", 205, [3, 2]],
    ]);
  });
});
