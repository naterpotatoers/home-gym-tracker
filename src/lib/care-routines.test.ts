import { describe, expect, it } from "vitest";
import { careRoutineExercises, careRoutines } from "./data/care-routines";
import { exerciseModalities, exercises } from "./data/exercises";
import { routineExercises, routines } from "./data/programs";

/**
 * Seed routine integrity — every prescription row (training fixtures + care
 * routines) must reference a real exercise × modality pair with a coherent
 * prescription, or the routine editor and session runner render broken rows.
 */

const allRoutines = [...routines, ...careRoutines];
const allRows = [...routineExercises, ...careRoutineExercises];

const exerciseById = new Map(exercises.map((e) => [e.id, e]));
const variantByKey = new Map(
  exerciseModalities.map((em) => [`${em.exerciseId}|${em.modalityId}`, em]),
);

describe("seed routine integrity", () => {
  it("care routine ids don't collide with the training fixtures", () => {
    const ids = allRoutines.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("every row belongs to a seed routine", () => {
    const routineIds = new Set(allRoutines.map((r) => r.id));
    for (const row of allRows) {
      expect(routineIds.has(row.routineId), row.routineId).toBe(true);
    }
  });

  it("every row references a real exercise × modality variant", () => {
    for (const row of allRows) {
      const label = `${row.routineId}#${row.order}`;
      expect(exerciseById.has(row.exerciseId), `${label} ${row.exerciseId}`).toBe(true);
      expect(
        variantByKey.has(`${row.exerciseId}|${row.modalityId}`),
        `${label} ${row.exerciseId}×${row.modalityId}`,
      ).toBe(true);
    }
  });

  it("band roles appear exactly on band rows, and match the variant", () => {
    for (const row of allRows) {
      const label = `${row.routineId}#${row.order}`;
      if (row.modalityId === "band") {
        expect(row.bandRole, label).not.toBe(null);
        const variant = variantByKey.get(`${row.exerciseId}|band`);
        expect(variant?.bandRoles, label).toContain(row.bandRole);
      } else {
        expect(row.bandRole, label).toBe(null);
      }
    }
  });

  it("prescriptions match the exercise's metric", () => {
    for (const row of allRows) {
      const label = `${row.routineId}#${row.order}`;
      const metric = exerciseById.get(row.exerciseId)?.metricType;
      if (metric === "time") {
        expect(row.durationSeconds, label).not.toBe(null);
      } else if (metric === "reps") {
        expect(row.repMin ?? row.repMax, label).not.toBe(null);
      }
      // distance rows log their distance at session time — nothing to assert.
      expect(row.sets, label).toBeGreaterThan(0);
    }
  });

  it("mobility rows carry no RIR target", () => {
    for (const row of allRows) {
      if (exerciseById.get(row.exerciseId)?.pattern !== "mobility") continue;
      expect(row.targetRir, `${row.routineId}#${row.order}`).toBe(null);
    }
  });

  it("order values run 1..n contiguously per routine", () => {
    const byRoutine = new Map<string, number[]>();
    for (const row of allRows) {
      const list = byRoutine.get(row.routineId) ?? [];
      list.push(row.order);
      byRoutine.set(row.routineId, list);
    }
    for (const [routineId, orders] of byRoutine) {
      const sorted = [...orders].sort((a, b) => a - b);
      expect(
        sorted,
        routineId,
      ).toEqual(Array.from({ length: sorted.length }, (_, i) => i + 1));
    }
  });
});
