import { describe, expect, it } from "vitest";
import { builtInRoutineRows, builtInRoutines, builtInRowsFor } from "./built-in-routines";
import { exerciseModalities, exercises } from "./data/exercises";
import { routineExercises, routines } from "./data/programs";
import { estimatedMinutes, estimatedSeconds } from "./routine-time";

/**
 * Seed routine integrity — every prescription row (training fixtures + care
 * routines) must reference a real exercise × modality pair with a coherent
 * prescription, or the routine editor and session runner render broken rows.
 */

const allRoutines = [...routines, ...builtInRoutines];
const allRows = [...routineExercises, ...builtInRoutineRows];

const exerciseById = new Map(exercises.map((e) => [e.id, e]));
const variantByKey = new Map(
  exerciseModalities.map((em) => [`${em.exerciseId}|${em.modalityId}`, em]),
);

describe("seed routine integrity", () => {
  it("care/core routine ids don't collide with the training fixtures", () => {
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

describe("built-in finishers stay finisher-sized", () => {
  it.each(builtInRoutines.map((r) => [r.name, r.id]))(
    "%s: at most 3 exercises, under 10 minutes",
    (_name, id) => {
      const rows = builtInRowsFor(id);
      expect(rows.length).toBeGreaterThan(0);
      expect(rows.length).toBeLessThanOrEqual(3);
      expect(estimatedSeconds(rows)).toBeLessThanOrEqual(10 * 60);
    },
  );
});

describe("estimatedMinutes", () => {
  const row = {
    sets: 3,
    repMin: 10,
    repMax: 10,
    durationSeconds: null,
    restSeconds: 60,
    unilateralMode: "bilateral" as const,
    supersetGroup: null,
    conditioning: null,
  };

  it("counts work at 3 s/rep plus rest and a transition", () => {
    // 3 × (30 + 60) + 15
    expect(estimatedSeconds([row])).toBe(285);
    expect(estimatedMinutes([row])).toBe(5);
  });

  it("doubles one-side-at-a-time work and uses timed seconds", () => {
    expect(estimatedSeconds([{ ...row, unilateralMode: "single_side" }])).toBe(3 * (60 + 60) + 15);
    expect(estimatedSeconds([{ ...row, durationSeconds: 20, repMin: null, repMax: null }])).toBe(
      3 * (20 + 60) + 15,
    );
  });

  it("times a bike row by its piece: the interval scheme, else its steady seconds", () => {
    const bike = { ...row, sets: 1, repMin: null, repMax: null, restSeconds: 60 };
    const target = { targetWatts: null, targetRpm: null };
    // 8 × (20 + 10) = 240 s of work + rest + transition
    expect(estimatedSeconds([{ ...bike, conditioning: { ...target, intervalScheme: "8x20/10" } }])).toBe(
      240 + 60 + 15,
    );
    expect(
      estimatedSeconds([{ ...bike, durationSeconds: 300, conditioning: { ...target, intervalScheme: null } }]),
    ).toBe(300 + 60 + 15);
  });

  it("rests once per superset round, after the group's last row", () => {
    const a = { ...row, supersetGroup: "A" };
    // rounds: 3 × (30 + 30 + 60) + 2 transitions
    expect(estimatedSeconds([a, a])).toBe(3 * 120 + 30);
  });
});

