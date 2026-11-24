import { describe, expect, it } from "vitest";
import { careRoutineExercises, careRoutines } from "../data/care-routines";
import { clients, weighIns } from "../data/clients";
import {
  exerciseModalities,
  exerciseMuscleScores,
  exercises,
} from "../data/exercises";
import { foods } from "../data/foods";
import { assignments, programDays, programs, routines } from "../data/programs";
import { sessions, setLogs } from "../data/sessions";
import type { FoodLog, Run } from "../types";
import {
  assignmentToRow,
  clientToRow,
  exerciseModalityToRow,
  exerciseMuscleScoreToRow,
  exerciseToRow,
  foodLogToRow,
  foodToRow,
  programDayToRow,
  programToRow,
  routineExerciseToRow,
  routineToRow,
  rowToAssignment,
  rowToClient,
  rowToExercise,
  rowToExerciseModality,
  rowToExerciseMuscleScore,
  rowToFood,
  rowToFoodLog,
  rowToRun,
  runToRow,
  rowToProgram,
  rowToProgramDay,
  rowToRoutine,
  rowToRoutineExercise,
  rowToSession,
  rowToSetLog,
  sessionToRow,
  setLogToRow,
  weighInToRow,
  rowToWeighIn,
} from "./mappers";

/**
 * Round-trip every mapper pair over the real seed fixtures. AGENTS.md's
 * "both mapper directions must stay complete when a type changes" invariant,
 * pinned: a field added to a type but missed in either direction fails here
 * (the field vanishes on the trip).
 */

const foodLogFixture: FoodLog = {
  id: "fl_test",
  clientId: "nate",
  date: "2026-08-10",
  foodId: "f_chicken_breast",
  plateFraction: 0.5,
  kcal: 400,
  proteinG: 75,
  carbsG: 0,
  fatG: 9,
};

describe("mapper round-trips (row ↔ type symmetry)", () => {
  it("routines", () => {
    for (const r of [...routines, ...careRoutines]) {
      expect(rowToRoutine(routineToRow(r))).toEqual(r);
    }
  });

  it("routine exercises", () => {
    for (const r of careRoutineExercises) {
      expect(rowToRoutineExercise(routineExerciseToRow(r))).toEqual(r);
    }
  });

  it("programs, days, assignments", () => {
    for (const p of programs) expect(rowToProgram(programToRow(p))).toEqual(p);
    for (const d of programDays) {
      expect(rowToProgramDay(programDayToRow(d))).toEqual(d);
    }
    for (const a of assignments) {
      expect(rowToAssignment(assignmentToRow(a))).toEqual(a);
    }
  });

  it("sessions and set logs", () => {
    for (const s of sessions) expect(rowToSession(sessionToRow(s))).toEqual(s);
    for (const s of setLogs.slice(0, 40)) {
      expect(rowToSetLog(setLogToRow(s))).toEqual(s);
    }
  });

  it("conditioning: round-trips, and stays off strength rows (un-migrated DBs)", () => {
    const strength = setLogs[0];
    expect(Object.keys(setLogToRow(strength))).not.toContain("avg_watts");
    const bike = {
      ...strength,
      exerciseId: "echo_bike",
      modalityId: "cardio" as const,
      conditioning: { intervalScheme: "8x20/10", targetWatts: null, targetRpm: 55, avgWatts: 120, maxWatts: 300, avgRpm: 58, calories: 30 },
    };
    expect(rowToSetLog(setLogToRow(bike))).toEqual(bike);
    // A bike set with nothing entered reads back as null — same thing.
    const blank = { ...bike, conditioning: { intervalScheme: null, targetWatts: null, targetRpm: null, avgWatts: null, maxWatts: null, avgRpm: null, calories: null } };
    expect(rowToSetLog(setLogToRow(blank)).conditioning).toBeNull();
    const rx = { ...careRoutineExercises[0], conditioning: { intervalScheme: null, targetWatts: 150, targetRpm: null } };
    expect(rowToRoutineExercise(routineExerciseToRow(rx))).toEqual(rx);
  });

  it("effort: written only when set (un-migrated DBs), round-trips, cleared → null on the wire", () => {
    const bike = {
      ...setLogs[0],
      exerciseId: "echo_bike",
      modalityId: "cardio" as const,
      conditioning: { intervalScheme: "8x20/10", targetWatts: 120, targetRpm: null, avgWatts: 116, maxWatts: 136, avgRpm: 45, calories: 20 },
    };
    // No effort key → no effort column in the write.
    expect(Object.keys(setLogToRow(bike))).not.toContain("effort");
    const rated = { ...bike, conditioning: { ...bike.conditioning, effort: 6 } };
    expect(setLogToRow(rated)).toMatchObject({ effort: 6 });
    expect(rowToSetLog(setLogToRow(rated))).toEqual(rated);
    // Clearing sends null (so the old value is overwritten) and reads back as no effort.
    const cleared = { ...bike, conditioning: { ...bike.conditioning, effort: null } };
    expect(setLogToRow(cleared)).toMatchObject({ effort: null });
    expect(rowToSetLog(setLogToRow(cleared))).toEqual(bike);
  });

  it("clients and weigh-ins", () => {
    for (const c of clients) expect(rowToClient(clientToRow(c))).toEqual(c);
    for (const w of weighIns) expect(rowToWeighIn(weighInToRow(w))).toEqual(w);
  });

  it("exercise catalog trio (aliases survive the trip)", () => {
    for (const e of exercises) {
      // Seed rows may omit `aliases`; the DB trip always materializes [].
      expect(rowToExercise(exerciseToRow(e))).toEqual({
        ...e,
        aliases: [...(e.aliases ?? [])],
      });
    }
    for (const s of exerciseMuscleScores.slice(0, 40)) {
      expect(rowToExerciseMuscleScore(exerciseMuscleScoreToRow(s))).toEqual(s);
    }
    // All of them: the per-variant load-shape fields are set on only a few.
    for (const m of exerciseModalities) {
      expect(rowToExerciseModality(exerciseModalityToRow(m))).toEqual(m);
    }
  });

  it("cues: omitted on write when empty; a pre-migration row reads back as none", () => {
    const base = { id: "ex_x", name: "X", pattern: "squat", metricType: "reps", isCompound: false } as const;
    expect("cues" in exerciseToRow({ ...base, cues: [] })).toBe(false);
    expect("cues" in exerciseToRow(base)).toBe(false);
    expect(exerciseToRow({ ...base, cues: ["Brace."] }).cues).toEqual(["Brace."]);
    const { cues: _omitted, ...legacy } = exerciseToRow({ ...base, cues: ["Brace."] });
    void _omitted;
    expect(rowToExercise(legacy).cues).toEqual([]);
  });

  it("variant load-shape columns are omitted at their defaults", () => {
    // Inserts must keep working against a table without the 2026-10-24
    // columns, and rows read from it must default them.
    const plain = exerciseModalities.find((m) => m.implements === null && !m.loadIncludesBodyweight)!;
    const row = exerciseModalityToRow(plain);
    expect("implements" in row).toBe(false);
    expect("load_includes_bodyweight" in row).toBe(false);
    expect(rowToExerciseModality(row)).toEqual(plain);

    const weighted = exerciseModalities.find((m) => m.loadIncludesBodyweight)!;
    const weightedRow = exerciseModalityToRow(weighted);
    expect(weightedRow.implements).toBe(weighted.implements);
    expect(weightedRow.load_includes_bodyweight).toBe(true);
  });

  it("nutrition", () => {
    for (const f of foods) expect(rowToFood(foodToRow(f))).toEqual(f);
    expect(rowToFoodLog(foodLogToRow(foodLogFixture))).toEqual(foodLogFixture);
  });

  it("runs (every source)", () => {
    for (const source of ["manual", "strava", "garmin"] as const) {
      const run: Run = {
        id: `run_${source}`,
        clientId: "nate",
        date: "2026-11-14",
        distanceMiles: 5.02,
        durationSeconds: 2820,
        kind: "long",
        avgHeartRate: source === "manual" ? null : 151,
        elevationGainFt: source === "manual" ? null : 164,
        name: "Morning Run",
        source,
        externalId: source === "manual" ? null : `${source}:1`,
        notes: "felt good",
      };
      expect(rowToRun(runToRow(run))).toEqual(run);
    }
  });
});
