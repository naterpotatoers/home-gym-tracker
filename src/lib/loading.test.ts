import { describe, expect, it } from "vitest";
import {
  describePlates,
  formatPlates,
  loadableWeights,
  nearestLoadableWeight,
  platesFor,
  weightStep,
} from "./loading";

describe("loadableWeights", () => {
  // The smallest plate owned is 2.5 lb (no 1.25 pair yet), so a bar steps 5.
  it("starts at the empty bar and steps in 5 lb increments with no gaps", () => {
    const weights = loadableWeights("ohio_bar");
    expect(weights[0]).toBe(45);
    expect(loadableWeights("bella_bar")[0]).toBe(33);
    const inc = 5;
    // The advertised "no gaps" claim: every consecutive gap equals the increment.
    for (let i = 1; i < weights.length; i++) {
      expect(weights[i] - weights[i - 1]).toBe(inc);
    }
  });
});

describe("nearestLoadableWeight", () => {
  it("ties round down — completable beats maybe", () => {
    // 177.5 is equidistant between 175 and 180
    expect(nearestLoadableWeight(177.5)).toBe(175);
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
    expect(formatPlates(47.5)).toBeNull(); // needs the 1.25 lb pair
  });
});

describe("platesFor", () => {
  it("the weight names the bar — the Ohio's and the Bella's grids never overlap", () => {
    expect(platesFor(135)).toMatchObject({ barId: "ohio_bar", perSideLbs: [45] });
    expect(describePlates(platesFor(135)!)).toBe("45 per side");
    expect(platesFor(43)).toMatchObject({ barId: "bella_bar", barLbs: 33, perSideLbs: [5] });
    expect(describePlates(platesFor(43)!)).toBe("Bella Bar + 5 per side");
    expect(describePlates(platesFor(33)!)).toBe("empty Bella Bar");
    const both = new Set(loadableWeights("ohio_bar"));
    expect(loadableWeights("bella_bar").some((w) => both.has(w))).toBe(false);
  });

  it("no bar can build it → null", () => {
    expect(platesFor(46)).toBeNull();
    expect(platesFor(30)).toBeNull();
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

