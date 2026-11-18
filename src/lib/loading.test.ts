import { describe, expect, it } from "vitest";
import {
  describePlates,
  formatPlates,
  loadableWeights,
  nearestLoadableWeight,
  nextLoadStep,
  weightStep,
} from "./loading";

describe("loadableWeights", () => {
  it("starts at the empty bar and steps in 2.5 lb increments with no gaps", () => {
    const weights = loadableWeights("ohio_bar");
    expect(weights[0]).toBe(45);
    const inc = 2.5;
    // The advertised "no gaps" claim: every consecutive gap equals the increment.
    for (let i = 1; i < weights.length; i++) {
      expect(weights[i] - weights[i - 1]).toBe(inc);
    }
  });
});

describe("nearestLoadableWeight", () => {
  it("ties round down — completable beats maybe", () => {
    // 178.75 is equidistant between 177.5 and 180
    expect(nearestLoadableWeight(178.75)).toBe(177.5);
  });

  it("clamps below the empty bar to the bar", () => {
    expect(nearestLoadableWeight(10)).toBe(45);
  });
});

describe("formatPlates", () => {
  it("builds an exact per-side breakdown", () => {
    const breakdown = formatPlates(135)!;
    expect(breakdown.barLbs).toBe(45);
    expect(breakdown.perSideLbs.reduce((a, b) => a + b, 0)).toBe(45);
    expect(describePlates(breakdown)).toContain("per side");
  });

  it("empty bar renders as such", () => {
    expect(describePlates(formatPlates(45)!)).toBe("empty bar");
  });

  it("rejects unbuildable odd remainders", () => {
    expect(formatPlates(46)).toBeNull(); // 0.5 lb per side — impossible
    expect(formatPlates(40)).toBeNull(); // below the bar
  });
});

describe("weightStep", () => {
  it("plates and machines move by 5, dumbbells and added load by 2.5", () => {
    expect(weightStep("barbell")).toBe(5);
    expect(weightStep("machine")).toBe(5);
    expect(weightStep("dumbbell")).toBe(2.5);
    expect(weightStep("bodyweight")).toBe(2.5);
  });

  it("bands have no pound stepper", () => {
    expect(weightStep("band")).toBeNull();
  });
});

describe("nextLoadStep", () => {
  it("barbell: +5 on the bar's own plate grid, null past the top of the stack", () => {
    expect(nextLoadStep("barbell", 145)).toBe(150);
    expect(nextLoadStep("barbell", 147.5)).toBe(152.5);
    expect(nextLoadStep("barbell", 63)).toBe(68); // Bella grid (33 + 2.5k)
    expect(nextLoadStep("barbell", 137)).toBe(142.5); // off-grid → next buildable
    const top = loadableWeights("ohio_bar").at(-1)!;
    expect(nextLoadStep("barbell", top)).toBeNull();
  });

  it("dumbbell: the next pair you own", () => {
    expect(nextLoadStep("dumbbell", 10)).toBe(15);
    expect(nextLoadStep("dumbbell", 45)).toBe(50);
    expect(nextLoadStep("dumbbell", 47)).toBe(50);
    expect(nextLoadStep("dumbbell", 50)).toBeNull();
  });

  it("bodyweight progresses by reps until something's held; bands and cardio never get pounds", () => {
    expect(nextLoadStep("bodyweight", 0)).toBeNull();
    expect(nextLoadStep("bodyweight", 10)).toBe(15);
    expect(nextLoadStep("machine", 100)).toBe(105);
    expect(nextLoadStep("band", 0)).toBeNull();
    expect(nextLoadStep("cardio", 0)).toBeNull();
  });
});

