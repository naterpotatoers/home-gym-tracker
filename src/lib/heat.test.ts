import { describe, expect, it } from "vitest";
import type { MuscleCoverage } from "./coverage";
import { coverageHeat, coverageMax, heatBin, heatFromScores } from "./heat";
import type { MuscleId } from "./types";

const coverage = (rows: [MuscleId, number][]): Map<MuscleId, MuscleCoverage> =>
  new Map(rows.map(([muscleId, weightedSets]) => [muscleId, { muscleId, weightedSets, peakScore: 10, exerciseIds: [] }]));

describe("heatBin", () => {
  it("maps (0,1] onto ramp bins 0..12", () => {
    expect(heatBin(1)).toBe(12);
    expect(heatBin(0.999)).toBe(12);
    expect(heatBin(0.5)).toBe(6);
    expect(heatBin(0.01)).toBe(0);
  });
});

describe("coverageHeat", () => {
  const week = coverage([
    ["quads", 8],
    ["abs", 2],
    ["calves", 0],
  ]);

  it("normalizes weighted sets against the screen's max", () => {
    expect(coverageMax(week)).toBe(8);
    const heat = coverageHeat(week);
    expect(heat.get("quads")).toEqual({ intensity: 1, detail: "Quads — 8.0 weighted sets/week" });
    expect(heat.get("abs")!.intensity).toBe(0.25);
  });

  it("zero work has zero intensity (rendered outline-only, never the red end)", () => {
    expect(coverageHeat(week).get("calves")).toEqual({ intensity: 0, detail: "Calves — not prescribed" });
  });

  it("survives an all-zero screen without dividing by zero", () => {
    expect(coverageHeat(coverage([["abs", 0]])).get("abs")!.intensity).toBe(0);
  });
});

describe("heatFromScores", () => {
  it("score / 10, labelled with the muscle name", () => {
    const heat = heatFromScores([{ muscleId: "quads", score: 7 }]);
    expect(heat.get("quads")).toEqual({ intensity: 0.7, detail: "Quads — score 7" });
  });
});
