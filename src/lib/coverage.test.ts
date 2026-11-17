import { describe, expect, it } from "vitest";
import { muscles } from "./data/muscles";
import { modalities } from "./data/modalities";
import { seedSnapshot } from "./data/seed-snapshot";
import {
  coverageByGroup,
  coverageStatus,
  neglectedMuscles,
  prescribedCoverage,
  weekCoverage,
} from "./coverage";
import { effectiveScores } from "./modality";
import type { RoutineExercise } from "./types";

const data = seedSnapshot();

describe("effectiveScores", () => {
  it("a modality modifier adjusts, never introduces, a muscle (and stays 0–10)", () => {
    for (const em of data.exerciseModalities) {
      const base = new Map(
        (data.scoresByExercise.get(em.exerciseId) ?? []).map((s) => [s.muscleId, s.score]),
      );
      const scores = effectiveScores(data, em.exerciseId, em.modalityId);
      for (const [muscleId, score] of scores) {
        expect(base.has(muscleId)).toBe(true);
        expect(score).toBeGreaterThanOrEqual(0);
        expect(score).toBeLessThanOrEqual(10);
      }
    }
  });

  it("mobility work and unknown exercises score nothing", () => {
    const mobility = data.exercises.find((e) => e.pattern === "mobility")!;
    expect(effectiveScores(data, mobility.id, "bodyweight").size).toBe(0);
    expect(effectiveScores(data, "no_such_exercise", "barbell").size).toBe(0);
  });

  it("modifiers actually apply where a modality has them", () => {
    const withMods = modalities.find((m) => m.muscleModifiers.length > 0);
    if (!withMods) return;
    const mod = withMods.muscleModifiers[0];
    const em = data.exerciseModalities.find(
      (v) =>
        v.modalityId === withMods.id &&
        (data.scoresByExercise.get(v.exerciseId) ?? []).some(
          (s) => s.muscleId === mod.muscleId && s.score + mod.delta >= 0 && s.score + mod.delta <= 10,
        ),
    );
    if (!em) return;
    const base = data.scoresByExercise.get(em.exerciseId)!.find((s) => s.muscleId === mod.muscleId)!;
    expect(effectiveScores(data, em.exerciseId, em.modalityId).get(mod.muscleId)).toBe(base.score + mod.delta);
  });
});

describe("prescribedCoverage", () => {
  const routineId = [...data.exercisesByRoutine.keys()][0];
  const rows = data.exercisesByRoutine.get(routineId)!;

  it("has a row for every muscle; weighted sets = Σ sets × score/10", () => {
    const coverage = prescribedCoverage(data, rows);
    expect(coverage.size).toBe(muscles.length);
    for (const [muscleId, row] of coverage) {
      let expected = 0;
      for (const rx of rows) {
        const score = effectiveScores(data, rx.exerciseId, rx.modalityId).get(muscleId) ?? 0;
        if (score > 0) expected += rx.sets * (score / 10);
      }
      expect(row.weightedSets).toBeCloseTo(expected, 6);
    }
  });

  it("doubling the sets doubles the dose", () => {
    const doubled: RoutineExercise[] = rows.map((r) => ({ ...r, sets: r.sets * 2 }));
    const one = prescribedCoverage(data, rows);
    const two = prescribedCoverage(data, doubled);
    for (const [id, row] of one) expect(two.get(id)!.weightedSets).toBeCloseTo(row.weightedSets * 2, 6);
  });

  it("an empty routine neglects everything", () => {
    const coverage = prescribedCoverage(data, []);
    expect(neglectedMuscles(coverage)).toHaveLength(muscles.length);
  });
});

describe("coverage status and grouping", () => {
  const row = (weightedSets: number, peakScore: number) => ({
    muscleId: muscles[0].id,
    weightedSets,
    peakScore,
    exerciseIds: [],
  });
  it("thresholds: <2 sets or peak <5 neglected, <6 light, else solid", () => {
    expect(coverageStatus(row(1.9, 10))).toBe("neglected");
    expect(coverageStatus(row(8, 4))).toBe("neglected");
    expect(coverageStatus(row(5.9, 10))).toBe("light");
    expect(coverageStatus(row(6, 7))).toBe("solid");
  });
  it("coverageByGroup keeps every muscle exactly once", () => {
    const groups = coverageByGroup(prescribedCoverage(data, []));
    const ids = groups.flatMap((g) => g.rows.map((r) => r.muscleId));
    expect(ids.sort()).toEqual(muscles.map((m) => m.id).sort());
  });
  it("weekCoverage counts a routine scheduled twice twice", () => {
    const day = data.programDays[0];
    const once = weekCoverage(data, day.programId, day.week);
    const doubled = { ...data, programDays: [...data.programDays, { ...day, dayOfWeek: ((day.dayOfWeek % 7) + 1) as typeof day.dayOfWeek }] };
    const twice = weekCoverage(doubled, day.programId, day.week);
    const single = prescribedCoverage(data, data.exercisesByRoutine.get(day.routineId) ?? []);
    for (const [id, row] of once) {
      expect(twice.get(id)!.weightedSets).toBeCloseTo(row.weightedSets + single.get(id)!.weightedSets, 6);
    }
  });
});
