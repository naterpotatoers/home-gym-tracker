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
import type { FoodLog } from "../types";
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
});
