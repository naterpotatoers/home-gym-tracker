import { describe, expect, it } from "vitest";
import {
  isBandRole,
  isEquipmentId,
  isMetricType,
  isModalityId,
  isMovementPattern,
  isMuscleId,
  isSessionCondition,
  isUnilateralMode,
  finishProblem,
  isLocalPath,
  exercisePayloadProblem,
  normalizeExercisePayload,
  parseBikeWarmup,
  parseProfile,
  parseRunForm,
  routineExerciseProblem,
  setListProblem,
  setLogProblem,
} from "./validate";

describe("write-path FK guards", () => {
  it("accepts known reference ids", () => {
    expect(isModalityId("barbell")).toBe(true);
    expect(isSessionCondition("good")).toBe(true);
    expect(isMuscleId("lats")).toBe(true);
    expect(isEquipmentId("rack")).toBe(true);
    expect(isMovementPattern("pull_h")).toBe(true);
    expect(isMetricType("time")).toBe(true);
    expect(isBandRole("assistance")).toBe(true);
    expect(isUnilateralMode("single_side")).toBe(true);
  });

  it("rejects unknown or stale ids", () => {
    expect(isModalityId("kettlebell")).toBe(false);
    expect(isSessionCondition("meh")).toBe(false);
    expect(isMuscleId("delts")).toBe(false); // split into front/side/rear
    expect(isMuscleId("")).toBe(false);
    expect(isEquipmentId("cable_stack")).toBe(false);
    expect(isMovementPattern("push")).toBe(false);
    expect(isMetricType("weight")).toBe(false);
    expect(isBandRole("support")).toBe(false);
    expect(isUnilateralMode("unilateral")).toBe(false);
  });
});

describe("parseProfile", () => {
  const form = (fields: Record<string, string>) => {
    const f = new FormData();
    const base = {
      firstName: "Ana",
      dateOfBirth: "1990-01-01",
      heightInches: "65",
      experienceLevel: "beginner",
      goal: "strength",
      color: "",
      notes: "",
    };
    for (const [k, v] of Object.entries({ ...base, ...fields })) f.set(k, v);
    return f;
  };

  it("accepts presets and no color", () => {
    expect(parseProfile(form({ color: "#3987e5" }))).toMatchObject({ color: "#3987e5" });
    expect(parseProfile(form({}))).toMatchObject({ color: null });
  });

  it("rejects free hex unless it's the person's current color", () => {
    expect(parseProfile(form({ color: "#123456" }))).toEqual({
      error: "Pick one of the preset colors.",
    });
    expect(parseProfile(form({ color: "#123456" }), "#123456")).toMatchObject({ color: "#123456" });
  });

  it("validates the required fields", () => {
    expect(parseProfile(form({ firstName: " " }))).toHaveProperty("error");
    expect(parseProfile(form({ heightInches: "200" }))).toHaveProperty("error");
    expect(parseProfile(form({ goal: "bulk" }))).toHaveProperty("error");
  });
});

describe("setListProblem", () => {
  const at = (id: string, position: number) => ({ id, position });
  it("accepts 1..n in any order", () => {
    expect(setListProblem([at("b", 2), at("a", 1)])).toBeNull();
    expect(setListProblem([])).toBeNull();
  });
  it("rejects gaps, duplicates, zero-based, and repeated ids", () => {
    expect(setListProblem([at("a", 1), at("b", 3)])).not.toBeNull();
    expect(setListProblem([at("a", 1), at("b", 1)])).not.toBeNull();
    expect(setListProblem([at("a", 0), at("b", 1)])).not.toBeNull();
    expect(setListProblem([at("a", 1), at("a", 2)])).not.toBeNull();
  });
});

describe("finishProblem", () => {
  const ok = { durationMinutes: 45, notes: "", rpe: 7, condition: "good" as const };
  it("accepts a normal check-in and an empty one", () => {
    expect(finishProblem(ok)).toBeNull();
    expect(finishProblem({ durationMinutes: null, notes: "", rpe: null, condition: null })).toBeNull();
  });
  it("rejects out-of-range values", () => {
    expect(finishProblem({ ...ok, rpe: 11 })).not.toBeNull();
    expect(finishProblem({ ...ok, rpe: 6.5 })).not.toBeNull();
    expect(finishProblem({ ...ok, durationMinutes: -1 })).not.toBeNull();
    expect(finishProblem({ ...ok, condition: "meh" as never })).not.toBeNull();
  });
});

describe("isLocalPath", () => {
  it("allows in-app paths only", () => {
    expect(isLocalPath("/workout/session/s_1")).toBe(true);
    expect(isLocalPath("//evil.example")).toBe(false);
    expect(isLocalPath("/\\evil.example")).toBe(false);
    expect(isLocalPath("https://evil.example")).toBe(false);
  });
});

describe("routineExerciseProblem", () => {
  const ok = {
    routineId: "r",
    order: 1,
    exerciseId: "squat",
    modalityId: "barbell",
    bandRole: null,
    unilateralMode: "bilateral",
    sets: 3,
    repMin: 8,
    repMax: 10,
    durationSeconds: null,
    restSeconds: 90,
    targetRir: 2,
    supersetGroup: null,
    notes: "",
    conditioning: null,
  } as const;
  it("accepts a normal prescription", () => {
    expect(routineExerciseProblem({ ...ok })).toBeNull();
    expect(routineExerciseProblem({ ...ok, supersetGroup: "A" })).toBeNull();
  });
  it("rejects bad ranges and ids", () => {
    expect(routineExerciseProblem({ ...ok, repMin: 12 })).not.toBeNull();
    expect(routineExerciseProblem({ ...ok, sets: 0 })).not.toBeNull();
    expect(routineExerciseProblem({ ...ok, restSeconds: -5 })).not.toBeNull();
    expect(routineExerciseProblem({ ...ok, targetRir: 2.5 })).not.toBeNull();
    expect(routineExerciseProblem({ ...ok, modalityId: "kettlebell" as never })).not.toBeNull();
    expect(routineExerciseProblem({ ...ok, supersetGroup: "" })).not.toBeNull();
  });
  it("checks a bike row's scheme and targets (the DB CHECK's rules)", () => {
    const bike = (c: object) => ({ ...ok, conditioning: { intervalScheme: null, targetWatts: null, targetRpm: null, ...c } });
    expect(routineExerciseProblem(bike({ intervalScheme: "8x20/10", targetWatts: 200 }))).toBeNull();
    expect(routineExerciseProblem(bike({ targetRpm: 55 }))).toBeNull();
    expect(routineExerciseProblem(bike({ intervalScheme: "20/10" }))).not.toBeNull();
    expect(routineExerciseProblem(bike({ targetWatts: 0 }))).not.toBeNull();
    expect(routineExerciseProblem(bike({ targetRpm: 300 }))).not.toBeNull();
  });
});

describe("setLogProblem (conditioning)", () => {
  const base = {
    id: "sl", sessionId: "s", exerciseId: "echo_bike", modalityId: "cardio", position: 1, setNumber: 1,
    unilateralMode: "bilateral", side: null, reps: null, weightLbs: null, addedWeightLbs: null,
    bandId: null, bandRole: null, durationSeconds: 240, distanceFeet: null, rir: null,
    isWarmup: false, completed: true, notes: "",
  } as const;
  const log = { intervalScheme: "8x20/10", targetWatts: 200, targetRpm: null, avgWatts: 182, maxWatts: 410, avgRpm: 64, calories: 38 };
  it("accepts a console readout", () => {
    expect(setLogProblem({ ...base, conditioning: log })).toBeNull();
    expect(setLogProblem({ ...base, conditioning: null })).toBeNull();
  });
  it("rejects impossible readings", () => {
    expect(setLogProblem({ ...base, conditioning: { ...log, avgWatts: -1 } })).not.toBeNull();
    expect(setLogProblem({ ...base, conditioning: { ...log, calories: 1.5 } })).not.toBeNull();
    expect(setLogProblem({ ...base, conditioning: { ...log, intervalScheme: "bad" } })).not.toBeNull();
  });
});

describe("parseRunForm", () => {
  const form = (fields: Record<string, string>) => ({ get: (k: string) => fields[k] ?? null });
  const ok = { date: "2026-11-14", miles: "5.004", time: "46:40", kind: "long", notes: " felt good " };
  it("parses a valid run", () => {
    expect(parseRunForm(form(ok))).toEqual({
      date: "2026-11-14",
      distanceMiles: 5,
      durationSeconds: 2800,
      kind: "long",
      notes: "felt good",
    });
    expect(parseRunForm(form({ ...ok, kind: "" }))).toMatchObject({ kind: "easy" });
  });
  it("rejects bad fields", () => {
    for (const bad of [{ date: "nope" }, { miles: "0" }, { miles: "abc" }, { time: "soon" }, { kind: "sprint" }]) {
      expect(parseRunForm(form({ ...ok, ...bad }))).toHaveProperty("error");
    }
  });
});

describe("parseBikeWarmup", () => {
  const form = (entries: Record<string, string>) => ({ get: (k: string) => entries[k] ?? null });
  it("is on only when the checkbox was submitted", () => {
    expect(parseBikeWarmup(form({ bike_warmup: "on" }))).toBe(true);
    expect(parseBikeWarmup(form({}))).toBe(false);
  });
});

describe("exercisePayloadProblem — cues", () => {
  const payload = (cues: string[]) => ({
    name: "Squat",
    aliases: [],
    cues,
    pattern: "squat" as const,
    metricType: "reps" as const,
    isCompound: true,
    scores: [{ muscleId: "quads" as const, score: 10 }],
    modalities: [],
  });
  it("allows up to three short cues", () => {
    expect(exercisePayloadProblem(payload([]))).toBeNull();
    expect(exercisePayloadProblem(payload(["Brace.", "Knees out.", "Drive up."]))).toBeNull();
  });
  it("rejects a fourth or an over-long cue", () => {
    expect(exercisePayloadProblem(payload(["a", "b", "c", "d"]))).toMatch(/Too many cues/);
    expect(exercisePayloadProblem(payload(["x".repeat(91)]))).toMatch(/too long/);
  });
  it("validates what's saved: blanks and repeats are cleaned before counting", () => {
    const clean = normalizeExercisePayload({
      ...payload(["Brace.", "  ", "Knees  out.", "brace.", "Drive up."]),
      name: "  Back   Squat ",
      aliases: [" High-bar  squat "],
    });
    expect(clean).toMatchObject({
      name: "Back Squat",
      aliases: ["High-bar squat"],
      cues: ["Brace.", "Knees out.", "Drive up."],
    });
    expect(exercisePayloadProblem(clean)).toBeNull();
  });
});

