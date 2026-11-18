import { describe, expect, it } from "vitest";
import { seedSnapshot } from "./data/seed-snapshot";
import { buildGymData } from "./gym-data";
import { e1rm, weightForReps } from "./modality";
import {
  openBoardGroups,
  priorBestE1rm,
  recentVariantKeys,
  resumeTargetForClient,
  routineForDay,
  sessionRecap,
  sessionVolumeLbs,
  suggestedLoad,
} from "./queries";

const data = seedSnapshot();

describe("weightForReps (Epley inverted)", () => {
  it("round-trips: e1RM of the predicted weight at N reps is the e1RM back", () => {
    const set = data.setLogs.find((x) => x.modalityId === "barbell" && x.reps && !x.isWarmup)!;
    for (const reps of [1, 5, 8, 12]) {
      const weight = weightForReps(200, reps);
      expect(e1rm(data, { ...set, weightLbs: weight, reps })).toBeCloseTo(200, 6);
    }
  });

  it("at 0 reps is the e1RM itself", () => {
    expect(weightForReps(200, 0)).toBe(200);
  });
});

describe("suggestedLoad", () => {
  it("prefills from the most recent completed working set", () => {
    const load = suggestedLoad(data, "nate", "bench_press", "barbell");
    expect(load).not.toBeNull();
    expect(load!.weightLbs).toBeGreaterThan(0);
    expect(load!.bandId).toBeNull();
  });

  it("is null for a variant the client never trained", () => {
    expect(suggestedLoad(data, "nate", "donkey_kick", "bodyweight")).toBeNull();
  });
});

describe("routineForDay is week-aware", () => {
  // A 2-week program that schedules DIFFERENT routines for the same weekday.
  const weekData = buildGymData({
    source: "seed",
    clientsSource: "seed",
    nutritionSource: "database",
    foods: [],
    foodLogs: [],
    runsSource: "missing",
    runs: [],
    exercisesSource: "seed",
    exercises: data.exercises,
    exerciseMuscleScores: data.exerciseMuscleScores,
    exerciseModalities: data.exerciseModalities,
    clients: data.clients,
    routines: [
      { id: "r_week1", name: "Week 1 Day", notes: "" },
      { id: "r_week2", name: "Week 2 Day", notes: "" },
    ],
    routineExercises: [],
    programs: [{ id: "p_two", name: "Two Weeks", weeks: 2, notes: "" }],
    programDays: [
      { programId: "p_two", week: 1, dayOfWeek: 1, routineId: "r_week1" },
      { programId: "p_two", week: 2, dayOfWeek: 1, routineId: "r_week2" },
    ],
    assignments: [
      { id: "a1", programId: "p_two", clientId: "nate", startDate: "2026-07-06", status: "active" },
    ],
    sessions: [],
    setLogs: [],
    weighIns: [],
  });

  it("offers the current week's routine, not week 1 forever", () => {
    expect(routineForDay(weekData, "nate", 1, "2026-07-06")?.routineId).toBe("r_week1");
    expect(routineForDay(weekData, "nate", 1, "2026-07-13")?.routineId).toBe("r_week2");
  });

  it("stops once the program has run its length", () => {
    // Two weeks from Mon 2026-07-06: the last scheduled day is 07-19.
    expect(routineForDay(weekData, "nate", 7, "2026-07-19")).toBeNull(); // nothing on Sundays
    expect(routineForDay(weekData, "nate", 1, "2026-07-20")).toBeNull();
    expect(routineForDay(weekData, "nate", 1, "2026-09-01")).toBeNull();
  });

  it("returns null for a weekday with nothing scheduled", () => {
    expect(routineForDay(weekData, "nate", 3, "2026-07-06")).toBeNull();
  });
});

describe("priorBestE1rm", () => {
  // Nate's last barbell bench session in the seed is s_nate_0727.
  it("excludes the session's own sets from the bar it's measured against", () => {
    const withLast = priorBestE1rm(
      data, "nate", "bench_press", "barbell", "not_a_session", "2026-07-27",
    );
    const withoutLast = priorBestE1rm(
      data, "nate", "bench_press", "barbell", "s_nate_0727", "2026-07-27",
    );
    expect(withLast).not.toBeNull();
    expect(withoutLast).not.toBeNull();
    expect(withoutLast!).toBeLessThanOrEqual(withLast!);
  });

  it("is null for a variant with no prior history", () => {
    expect(
      priorBestE1rm(data, "nate", "donkey_kick", "bodyweight", "x", "2026-07-27"),
    ).toBeNull();
  });
});

describe("recentVariantKeys", () => {
  it("returns per-client keys, most recent first, capped", () => {
    const keys = recentVariantKeys(data, "nate", 5);
    expect(keys.length).toBeLessThanOrEqual(5);
    expect(keys[0]).toMatch(/^[a-z_]+\|[a-z_]+$/);
  });

  it("household-wide without a client", () => {
    expect(recentVariantKeys(data).length).toBeGreaterThan(0);
  });
});

describe("openBoardGroups", () => {
  const session = (id: string, date: string, status: "planned" | "completed") => ({
    id,
    clientId: "nate" as const,
    date,
    assignmentId: null,
    routineId: null,
    durationMinutes: null,
    rpe: null,
    condition: null,
    status,
    notes: "",
  });

  it("groups ≥2 planned sessions per date, newest date first", () => {
    const custom = buildGymData({
      ...data,
      sessions: [
        session("s1", "2026-08-01", "planned"),
        session("s2", "2026-08-01", "planned"),
        session("s3", "2026-08-03", "planned"),
        session("s4", "2026-08-04", "planned"),
        session("s5", "2026-08-04", "planned"),
        session("s6", "2026-08-04", "completed"),
      ],
      setLogs: [],
    });
    expect(openBoardGroups(custom)).toEqual([
      { date: "2026-08-04", sessionIds: ["s4", "s5"] },
      { date: "2026-08-01", sessionIds: ["s1", "s2"] },
    ]);
  });

  it("is empty when no date has two planned sessions", () => {
    expect(openBoardGroups(data)).toEqual([]);
  });
});

describe("resumeTargetForClient", () => {
  const session = (
    id: string,
    clientId: string,
    date: string,
    status: "planned" | "completed" = "planned",
  ) => ({
    id,
    clientId,
    date,
    assignmentId: null,
    routineId: "full_body_a",
    durationMinutes: null,
    rpe: null,
    condition: null,
    status,
    notes: "",
  });

  it("is null with nothing planned", () => {
    const custom = buildGymData({
      ...data,
      sessions: [session("s1", "nate", "2026-08-01", "completed")],
      setLogs: [],
    });
    expect(resumeTargetForClient(custom, "nate")).toBeNull();
  });

  it("routes a lone planned session to the solo runner", () => {
    const custom = buildGymData({
      ...data,
      sessions: [session("s1", "nate", "2026-08-01")],
      setLogs: [],
    });
    expect(resumeTargetForClient(custom, "nate")?.href).toBe("/workout/session/s1");
  });

  it("routes a board-group session to the shared board", () => {
    const custom = buildGymData({
      ...data,
      sessions: [
        session("s1", "nate", "2026-08-01"),
        session("s2", "friend", "2026-08-01"),
      ],
      setLogs: [],
    });
    expect(resumeTargetForClient(custom, "nate")?.href).toBe(
      "/workout/group/board?s=s1,s2",
    );
  });

  it("picks the newest planned session", () => {
    const custom = buildGymData({
      ...data,
      sessions: [
        session("s_old", "nate", "2026-07-20"),
        session("s_new", "nate", "2026-08-01"),
      ],
      setLogs: [],
    });
    expect(resumeTargetForClient(custom, "nate")?.sessionId).toBe("s_new");
  });
});

describe("sessionVolumeLbs", () => {
  const stubSet = (overrides: Partial<import("./types").SetLog>) => ({
    id: "sl_x",
    sessionId: "s_vol",
    exerciseId: "squat" as const,
    modalityId: "barbell" as const,
    position: 1,
    setNumber: 1,
    unilateralMode: "bilateral" as const,
    side: null,
    reps: 5,
    weightLbs: 100,
    addedWeightLbs: null,
    bandId: null,
    bandRole: null,
    durationSeconds: null,
    distanceFeet: null,
    rir: null,
    isWarmup: false,
    completed: true,
    notes: "",
    conditioning: null,
    ...overrides,
  });

  it("sums completed working sets only, and never counts ordinal work", () => {
    const custom = buildGymData({
      ...data,
      sessions: [
        {
          id: "s_vol",
          clientId: "nate",
          date: "2026-08-01",
          assignmentId: null,
          routineId: null,
          durationMinutes: null,
          rpe: null,
          condition: null,
          status: "completed",
          notes: "",
        },
      ],
      setLogs: [
        stubSet({ id: "a", position: 1 }), // 100 × 5 = 500
        stubSet({ id: "b", position: 2, isWarmup: true }), // warmup: out
        stubSet({ id: "c", position: 3, completed: false }), // skipped: out
        stubSet({
          id: "d",
          position: 4,
          exerciseId: "lateral_walk",
          modalityId: "band",
          bandId: "hip_band_small",
          bandRole: "resistance",
          weightLbs: null,
        }), // ordinal: no lbs
      ],
    });
    expect(sessionVolumeLbs(custom, "s_vol")).toBe(500);
  });
});

describe("sessionRecap", () => {
  const data = seedSnapshot();
  const completed = data.sessions
    .filter((s) => s.status === "completed" && (data.setsBySession.get(s.id)?.length ?? 0) > 0)
    .sort((a, b) => a.date.localeCompare(b.date));

  it("counts working sets and per-block done like the raw sets", () => {
    const session = completed[completed.length - 1];
    const recap = sessionRecap(data, session.id);
    const sets = data.setsBySession.get(session.id)!;
    expect(recap.workingSets).toBe(sets.filter((s) => s.completed && !s.isWarmup).length);
    expect(recap.blocks.reduce((n, b) => n + b.sets.length, 0)).toBe(sets.length);
    for (const b of recap.blocks) expect(b.done).toBe(b.sets.filter((s) => s.completed).length);
  });

  it("never calls a PR on a person's first session", () => {
    const first = completed.find((s) => s === completed.find((c) => c.clientId === s.clientId));
    for (const b of sessionRecap(data, first!.id).blocks) expect(b.pr).toBeNull();
  });

  it("every PR beats its prior best", () => {
    for (const s of completed) {
      for (const b of sessionRecap(data, s.id).blocks) {
        if (b.pr) expect(b.pr.bestLbs).toBeGreaterThan(b.pr.priorLbs);
      }
    }
  });
});
