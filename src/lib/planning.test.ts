import { describe, expect, it } from "vitest";
import { seedSnapshot } from "./data/seed-snapshot";
import { buildGymData } from "./gym-data";
import { plannedSessionFromRoutine, programWeekStatus, smartPrefill } from "./planning";
import type { RoutineExercise, Session } from "./types";

const data = seedSnapshot();
const TODAY = "2026-08-02";

function rx(overrides: Partial<RoutineExercise>): RoutineExercise {
  return {
    routineId: "r_test",
    order: 1,
    exerciseId: "bench_press",
    modalityId: "barbell",
    bandRole: null,
    unilateralMode: "bilateral",
    sets: 3,
    repMin: 10,
    repMax: 10,
    durationSeconds: null,
    restSeconds: 90,
    targetRir: 2,
    supersetGroup: null,
    notes: "",
    conditioning: null,
    ...overrides,
  };
}

describe("smartPrefill priority chain (pinned against seed data)", () => {
  it("tier 1: last working weight at the prescribed rep range", () => {
    const result = smartPrefill(data, "nate", rx({}), TODAY);
    expect(result?.weightLbs).toBe(145); // Nate's last 10-rep barbell bench set
  });

  it("tier 1 covers dumbbell history verbatim", () => {
    const result = smartPrefill(data, "nate", rx({ modalityId: "dumbbell" }), TODAY);
    expect(result?.weightLbs).toBe(50);
  });

  it("tier 3: cross-modality transfer snaps to owned equipment", () => {
    // Nate has never done dumbbell deadlifts; barbell strength transfers but
    // must snap to the heaviest owned pair (50s).
    const result = smartPrefill(
      data,
      "nate",
      rx({ exerciseId: "deadlift", modalityId: "dumbbell" }),
      TODAY,
    );
    expect(result?.weightLbs).toBe(50);
  });

  it("tier 4: never-done-anywhere stays blank", () => {
    const result = smartPrefill(
      data,
      "nate",
      rx({ exerciseId: "woodchopper", modalityId: "band", bandRole: "resistance", unilateralMode: "single_side" }),
      TODAY,
    );
    expect(result).toBeNull();
  });

  it("band history carries the band, never a fabricated pound value", () => {
    const result = smartPrefill(
      data,
      "lidia",
      rx({ exerciseId: "pull_up", modalityId: "band", bandRole: "assistance", repMin: 6, repMax: 6 }),
      TODAY,
    );
    expect(result?.bandId).toBe("band_blue");
    expect(result?.weightLbs).toBeNull();
  });

  it("never transfers INTO band work", () => {
    // Even with lat strength from pull-ups, a band-modality prescription with
    // no band history must not get invented numbers.
    const result = smartPrefill(
      data,
      "nate",
      rx({ exerciseId: "chest_fly", modalityId: "band", bandRole: "resistance" }),
      TODAY,
    );
    // Nate has dumbbell chest fly history at most — result is either null or
    // band-only fields; assert no pound value in every case.
    expect(result?.weightLbs ?? null).toBeNull();
  });
});

describe("plannedSessionFromRoutine", () => {
  it("creates one set per prescribed set with contiguous positions", () => {
    const routineId = data.routines[0].id;
    const prescriptions = data.exercisesByRoutine.get(routineId) ?? [];
    const expected = prescriptions.reduce((n, p) => n + p.sets, 0);
    const { sets } = plannedSessionFromRoutine(data, "nate", routineId, null, TODAY);
    expect(sets).toHaveLength(expected);
    expect(sets.map((s) => s.position)).toEqual(sets.map((_, i) => i + 1));
    expect(sets.every((s) => !s.completed && !s.isWarmup)).toBe(true);
  });

  it("throws on an unknown routine", () => {
    expect(() =>
      plannedSessionFromRoutine(data, "nate", "r_does_not_exist", null, TODAY),
    ).toThrow("That routine no longer exists.");
  });
});

describe("programWeekStatus", () => {
  const base = data.sessions[0];
  const completed = (date: string, routineId: string): Session => ({
    ...base,
    id: `s_${date}_${routineId}`,
    clientId: "nate",
    date,
    routineId,
    status: "completed",
  });

  it("matches one completed session to one scheduled day", () => {
    // Nate's Upper/Lower starts Mon 2026-06-15; Lower is Tue + Fri.
    const status = programWeekStatus(
      { ...data, sessions: [completed("2026-06-16", "r_lower")] },
      "nate",
      "2026-06-19",
    )!;
    expect(status.week).toBe(1);
    expect(status.finished).toBe(false);
    const lower = status.days.filter((d) => d.routineId === "r_lower");
    expect(lower.map((d) => [d.date, d.done])).toEqual([
      ["2026-06-16", true],
      ["2026-06-19", false],
    ]);
    expect(status.days.find((d) => d.isToday)?.date).toBe("2026-06-19");
  });

  it("ticks both days once two sessions exist", () => {
    const status = programWeekStatus(
      {
        ...data,
        sessions: [completed("2026-06-16", "r_lower"), completed("2026-06-19", "r_lower")],
      },
      "nate",
      "2026-06-20",
    )!;
    expect(status.days.filter((d) => d.done)).toHaveLength(2);
  });

  it("is finished past the program's last week", () => {
    // 8 weeks from 2026-06-15 ends before 2026-08-10.
    expect(programWeekStatus(data, "nate", "2026-08-09")!.finished).toBe(false);
    expect(programWeekStatus(data, "nate", "2026-08-10")!.finished).toBe(true);
  });

  it("is null without an active assignment", () => {
    expect(programWeekStatus({ ...data, assignments: [] }, "nate", TODAY)).toBeNull();
  });
});

describe("plannedSessionFromRoutine — conditioning rows", () => {
  it("one piece per set with the row's target, no reps or load", () => {
    const routine = { id: "r_echo", name: "Echo 20/10", notes: "" };
    const row = rx({
      routineId: "r_echo",
      exerciseId: "echo_bike",
      modalityId: "cardio",
      sets: 1,
      repMin: null,
      repMax: null,
      targetRir: null,
      conditioning: { intervalScheme: "8x20/10", targetWatts: 200, targetRpm: null },
    });
    const withEcho = buildGymData({
      ...data,
      routines: [...data.routines, routine],
      routineExercises: [...data.routineExercises, row],
    });
    const { sets } = plannedSessionFromRoutine(withEcho, "nate", "r_echo", null, TODAY);
    expect(sets).toHaveLength(1);
    expect(sets[0]).toMatchObject({
      reps: null,
      weightLbs: null,
      durationSeconds: 240,
      conditioning: { intervalScheme: "8x20/10", targetWatts: 200, targetRpm: null, avgWatts: null },
    });
  });
});

describe("plannedSessionFromRoutine — bike warm-up", () => {
  it("opens a lifting routine with one Echo Bike warm-up — a first one is the 20/10 preset, no target", () => {
    const prescriptions = data.exercisesByRoutine.get("r_full_a") ?? [];
    const expected = prescriptions.reduce((n, p) => n + p.sets, 0) + 1;
    const { sets } = plannedSessionFromRoutine(data, "nate", "r_full_a", null, TODAY, { bikeWarmup: true });
    expect(sets).toHaveLength(expected);
    expect(sets[0]).toMatchObject({
      exerciseId: "echo_bike",
      modalityId: "cardio",
      isWarmup: true,
      position: 1,
      durationSeconds: 240,
      reps: null,
      weightLbs: null,
      conditioning: { intervalScheme: "8x20/10", targetWatts: null, targetRpm: null, avgWatts: null },
    });
    expect(sets.slice(1).every((s) => !s.isWarmup)).toBe(true);
    expect(sets.map((s) => s.position)).toEqual(sets.map((_, i) => i + 1));
  });

  it("doesn't carry a finisher target into the warm-up", () => {
    const session = data.sessions.find((s) => s.clientId === "nate" && s.status === "completed")!;
    const template = data.setsBySession.get(session.id)![0];
    const withPiece = buildGymData({
      ...data,
      setLogs: [
        ...data.setLogs,
        {
          ...template,
          id: "sl_echo_prior",
          exerciseId: "echo_bike",
          modalityId: "cardio",
          reps: null,
          weightLbs: null,
          completed: true,
          isWarmup: false,
          conditioning: { intervalScheme: null, targetWatts: 180, targetRpm: null, avgWatts: 185, maxWatts: null, avgRpm: null, calories: null },
        },
      ],
    });
    const { sets } = plannedSessionFromRoutine(withPiece, "nate", "r_full_a", null, TODAY, { bikeWarmup: true });
    expect(sets[0].conditioning?.targetWatts).toBeNull();
  });

  it("picks up the person's last warm-up: its piece and target", () => {
    const session = data.sessions.find((s) => s.clientId === "nate" && s.status === "completed")!;
    const template = data.setsBySession.get(session.id)![0];
    const withWarmup = buildGymData({
      ...data,
      setLogs: [
        ...data.setLogs,
        {
          ...template,
          id: "sl_warm_prior",
          exerciseId: "echo_bike",
          modalityId: "cardio",
          reps: null,
          weightLbs: null,
          durationSeconds: 300,
          completed: true,
          isWarmup: true,
          conditioning: { intervalScheme: null, targetWatts: 150, targetRpm: null, avgWatts: 140, maxWatts: null, avgRpm: null, calories: null },
        },
      ],
    });
    const { sets } = plannedSessionFromRoutine(withWarmup, "nate", "r_full_a", null, TODAY, { bikeWarmup: true });
    expect(sets[0]).toMatchObject({
      isWarmup: true,
      durationSeconds: 300,
      conditioning: { intervalScheme: null, targetWatts: 150, avgWatts: null },
    });
  });

  it("skips care routines and leaves the default off", () => {
    const care = plannedSessionFromRoutine(data, "nate", "r_knee_care", null, TODAY, { bikeWarmup: true });
    expect(care.sets.some((s) => s.isWarmup)).toBe(false);
    const plain = plannedSessionFromRoutine(data, "nate", "r_full_a", null, TODAY);
    expect(plain.sets[0].exerciseId).not.toBe("echo_bike");
  });
});

describe("plannedSessionFromRoutine — last time's load", () => {
  const rowFor = (routineId: string, exerciseId: string) =>
    data.exercisesByRoutine.get(routineId)!.find((r) => r.exerciseId === exerciseId)!;
  const setsFor = (clientId: string, routineId: string, exerciseId: string) =>
    plannedSessionFromRoutine(data, clientId, routineId, null, TODAY).sets.filter((s) => s.exerciseId === exerciseId);

  it("every set at the top of the range last time still pre-fills last time's load — no auto bump", () => {
    // Gabriel rowed 95×10×3 against 8–10: going heavier is his call.
    const row = rowFor("r_upper_bb", "bent_over_row");
    expect([row.repMin, row.repMax]).toEqual([8, 10]);
    const sets = setsFor("gabriel", "r_upper_bb", "bent_over_row");
    expect(sets.every((s) => s.weightLbs === 95)).toBe(true);
  });

  it("a set short of the top keeps last time's load and the top rep target", () => {
    // Nate's dumbbell bench: 50 × 12/11/10 against 10–12.
    const sets = setsFor("nate", "r_full_a", "bench_press");
    expect(sets.every((s) => s.weightLbs === 50 && s.reps === 12)).toBe(true);
  });

  it("one missed set holds the dumbbells too (45 × 12/12/10)", () => {
    const sets = setsFor("nate", "r_full_b", "chest_supported_row");
    expect(sets.every((s) => s.weightLbs === 45)).toBe(true);
  });
});

