import { describe, expect, it } from "vitest";
import { heatBin, heatMax, heatValues, ordinalMax } from "./heat";
import type { MuscleVolume } from "./queries";

const vol = (
  muscleId: MuscleVolume["muscleId"],
  weightedVolumeLbs: number,
  ordinalReps = 0,
): MuscleVolume => ({
  muscleId,
  weightedVolumeLbs,
  ordinalReps,
  sets: weightedVolumeLbs > 0 || ordinalReps > 0 ? 1 : 0,
  peakScore: 10,
});

describe("heatBin", () => {
  it("maps (0,1] onto ramp bins 0..12", () => {
    expect(heatBin(1)).toBe(12);
    expect(heatBin(0.999)).toBe(12);
    expect(heatBin(0.5)).toBe(6);
    expect(heatBin(0.01)).toBe(0);
  });
});

describe("heatMax / ordinalMax", () => {
  it("takes the max across every period on screen — the shared scale", () => {
    const weekA = { volumes: [vol("quads", 5000), vol("abs", 1000)] };
    const weekB = { volumes: [vol("quads", 8000)] };
    expect(heatMax(weekA, weekB)).toBe(8000);
    expect(heatMax(weekA)).toBe(5000);
  });

  it("tracks ordinal reps on their own separate scale", () => {
    const inputs = { volumes: [vol("glute_med", 0, 120), vol("quads", 9000)] };
    expect(ordinalMax(inputs)).toBe(120);
    expect(heatMax(inputs)).toBe(9000);
  });
});

describe("heatValues", () => {
  it("normalizes loaded work against the shared max", () => {
    const values = heatValues({ volumes: [vol("quads", 4000)] }, 8000, 0);
    const quads = values.get("quads")!;
    expect(quads.intensity).toBeCloseTo(0.5);
    expect(quads.ordinalOnly).toBe(false);
    expect(quads.detail).toContain("lb·reps");
  });

  it("flags ordinal-only muscles and scales them on the ordinal axis", () => {
    const values = heatValues({ volumes: [vol("glute_med", 0, 60)] }, 8000, 120);
    const gluteMed = values.get("glute_med")!;
    expect(gluteMed.ordinalOnly).toBe(true);
    expect(gluteMed.intensity).toBeCloseTo(0.5);
    expect(gluteMed.detail).toContain("band");
    expect(gluteMed.detail).not.toContain("lb·reps");
  });

  it("mixed work is not ordinal-only, and mentions both units", () => {
    const values = heatValues({ volumes: [vol("glutes", 2000, 30)] }, 8000, 120);
    const glutes = values.get("glutes")!;
    expect(glutes.ordinalOnly).toBe(false);
    expect(glutes.detail).toContain("lb·reps");
    expect(glutes.detail).toContain("band reps");
  });

  it("zero work has zero intensity (rendered outline-only, never the red end)", () => {
    const values = heatValues({ volumes: [vol("calves", 0)] }, 8000, 120);
    const calves = values.get("calves")!;
    expect(calves.intensity).toBe(0);
    expect(calves.ordinalOnly).toBe(false);
    expect(calves.detail).toContain("not trained");
  });

  it("survives an all-zero screen without dividing by zero", () => {
    const values = heatValues({ volumes: [vol("abs", 0)] }, 0, 0);
    expect(values.get("abs")!.intensity).toBe(0);
  });
});
