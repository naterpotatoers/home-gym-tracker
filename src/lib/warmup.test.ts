import { describe, expect, it } from "vitest";
import { builtInRoutines } from "./built-in-routines";
import { seedSnapshot } from "./data/seed-snapshot";
import { buildGymData } from "./gym-data";
import type { RoutineExercise } from "./types";
import { BIKE_WARMUP_RX, isBikeWarmupSet, isLiftingRoutine, wantsBikeWarmup } from "./warmup";

const data = seedSnapshot();

function row(routineId: string, order: number, exerciseId: string, modalityId: RoutineExercise["modalityId"]): RoutineExercise {
  return { ...BIKE_WARMUP_RX, routineId, order, exerciseId, modalityId, notes: "", conditioning: null };
}

describe("wantsBikeWarmup", () => {
  it("is on for the seed lifting routines", () => {
    for (const id of ["r_full_a", "r_full_b", "r_upper_bb", "r_upper_db", "r_lower"]) {
      expect(isLiftingRoutine(data, id), id).toBe(true);
      expect(wantsBikeWarmup(data, id), id).toBe(true);
    }
  });

  it("is off for every built-in care and core finisher", () => {
    for (const routine of builtInRoutines) {
      expect(wantsBikeWarmup(data, routine.id), routine.id).toBe(false);
    }
  });

  it("is off for a bike-only routine, one that already opens on the bike, an ab-only one, and an unknown id", () => {
    const withExtras = buildGymData({
      ...data,
      routines: [
        ...data.routines,
        { id: "r_echo", name: "Echo 20/10", notes: "" },
        { id: "r_bike_first", name: "Bike then squat", notes: "" },
        { id: "r_abs", name: "Abs", notes: "" },
      ],
      routineExercises: [
        ...data.routineExercises,
        row("r_echo", 1, "echo_bike", "cardio"),
        row("r_bike_first", 1, "echo_bike", "cardio"),
        row("r_bike_first", 2, "squat", "barbell"),
        row("r_abs", 1, "plank", "bodyweight"),
        row("r_abs", 2, "side_plank", "bodyweight"),
      ],
    });
    expect(wantsBikeWarmup(withExtras, "r_echo")).toBe(false);
    expect(wantsBikeWarmup(withExtras, "r_bike_first")).toBe(false);
    expect(wantsBikeWarmup(withExtras, "r_abs")).toBe(false);
    expect(wantsBikeWarmup(withExtras, "nope")).toBe(false);
  });

  it("is off when the catalog has no Echo Bike", () => {
    const noBike = buildGymData({
      ...data,
      exercises: data.exercises.filter((e) => e.id !== "echo_bike"),
      exerciseModalities: data.exerciseModalities.filter((m) => m.exerciseId !== "echo_bike"),
    });
    expect(wantsBikeWarmup(noBike, "r_full_a")).toBe(false);
  });
});

describe("isBikeWarmupSet", () => {
  it("needs the Echo Bike, cardio, and the warm-up flag", () => {
    expect(isBikeWarmupSet({ exerciseId: "echo_bike", modalityId: "cardio", isWarmup: true })).toBe(true);
    expect(isBikeWarmupSet({ exerciseId: "echo_bike", modalityId: "cardio", isWarmup: false })).toBe(false);
    expect(isBikeWarmupSet({ exerciseId: "squat", modalityId: "barbell", isWarmup: true })).toBe(false);
  });
});
