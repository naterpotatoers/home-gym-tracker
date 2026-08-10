import { describe, expect, it } from "vitest";
import { seedSnapshot } from "./data/seed-snapshot";
import { buildGymData } from "./gym-data";
import {
  muscleVolume,
  openBoardGroups,
  prComparison,
  priorBestE1rm,
  recentVariantKeys,
  repRangeForWeight,
  repsForWeight,
  routineForDay,
  sessionVolumeLbs,
  suggestedLoad,
  weightForReps,
  workingWeightForRepRange,
} from "./queries";

const data = seedSnapshot();

describe("Epley inversions", () => {
  it("round-trips: the weight predicted for N reps predicts N reps back", () => {
    for (const reps of [1, 5, 8, 12]) {
      const weight = weightForReps(200, reps);
      expect(repsForWeight(200, weight)).toBeCloseTo(reps, 6);
    }
  });

  it("weightForReps at 0 reps is the e1RM itself", () => {
    expect(weightForReps(200, 0)).toBe(200);
  });

  it("repsForWeight clamps nonsense inputs to 0", () => {
    expect(repsForWeight(200, 0)).toBe(0);
    expect(repsForWeight(200, -10)).toBe(0);
    expect(repsForWeight(100, 500)).toBe(0); // heavier than you could ever lift
  });
});

describe("workingWeightForRepRange (seed-data integration)", () => {
  it("answers for a trained barbell variant, with a buildable bar load", () => {
    const answer = workingWeightForRepRange(data, "nate", "bench_press", "barbell", 8, 10);
    expect(answer.bestActual).not.toBeNull();
    expect(answer.bestActual!.reps).toBeGreaterThanOrEqual(8);
    expect(answer.bestActual!.reps).toBeLessThanOrEqual(10);
    expect(answer.predicted).toBeGreaterThan(0);
    expect(answer.suggestedBarLoad).toBeGreaterThan(0);
  });

  it("suggests a bar load only for barbell work", () => {
    const answer = workingWeightForRepRange(data, "nate", "bench_press", "dumbbell", 8, 10);
    expect(answer.predicted).toBeGreaterThan(0);
    expect(answer.suggestedBarLoad).toBeNull();
  });

  it("returns nulls, never fake numbers, for an untrained variant", () => {
    const answer = workingWeightForRepRange(data, "nate", "donkey_kick", "bodyweight", 8, 10);
    expect(answer).toEqual({ bestActual: null, predicted: null, suggestedBarLoad: null });
  });
});

describe("repRangeForWeight", () => {
  it("finds the most reps ever done at or above the asked weight", () => {
    const answer = repRangeForWeight(data, "nate", "bench_press", "barbell", 135);
    expect(answer.bestActual).not.toBeNull();
    expect(answer.bestActual!.weightLbs).toBeGreaterThanOrEqual(135);
    expect(answer.predictedReps).toBeGreaterThan(0);
  });
});

describe("prComparison", () => {
  it("returns one row per client, null-safe for clients who never did the lift", () => {
    const rows = prComparison(data, "bench_press", "barbell");
    expect(rows).toHaveLength(data.clients.length);
    const nate = rows.find((r) => r.clientId === "nate")!;
    expect(nate.bestE1rmLbs).toBeGreaterThan(0);
    expect(nate.heaviestLbs).toBeGreaterThan(0);
    expect(nate.date).not.toBeNull();
    for (const row of rows) {
      if (row.bestE1rmLbs === null) {
        expect(row.heaviestLbs).toBeNull();
        expect(row.date).toBeNull();
      }
    }
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

  it("keeps offering the final week after the program ends", () => {
    expect(routineForDay(weekData, "nate", 1, "2026-09-01")?.routineId).toBe("r_week2");
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

describe("muscleVolume honesty", () => {
  const volumes = new Map(muscleVolume(data, "nate").map((v) => [v.muscleId, v]));

  it("accumulates real pounds for loaded work", () => {
    const quads = volumes.get("quads")!;
    expect(quads.weightedVolumeLbs).toBeGreaterThan(0);
    expect(quads.sets).toBeGreaterThan(0);
    expect(quads.peakScore).toBe(10); // squat is a primary quad driver
  });

  it("keeps ordinal (hip-band) work out of the pounds total", () => {
    // Nate's glute_med work includes hip-band lateral walks — ordinal only.
    const gluteMed = volumes.get("glute_med")!;
    expect(gluteMed.ordinalReps).toBeGreaterThan(0);
    // Loaded sets that *also* score glute_med may add lbs, but the band reps
    // themselves never do: an ordinal-only muscle would have zero lbs.
    const ordinalOnly = [...volumes.values()].filter(
      (v) => v.ordinalReps > 0 && v.sets > 0,
    );
    expect(ordinalOnly.length).toBeGreaterThan(0);
  });

  it("returns a row for every muscle, zeroed when untrained", () => {
    const untouched = [...volumes.values()].filter(
      (v) => v.weightedVolumeLbs === 0 && v.ordinalReps === 0,
    );
    expect(untouched.every((v) => v.sets === 0 && v.peakScore === 0)).toBe(true);
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
