import { describe, expect, it } from "vitest";
import {
  describePlates,
  formatPlates,
  loadableWeights,
  nearestLoadableWeight,
  smallestIncrement,
} from "./loading";

describe("loadableWeights", () => {
  it("starts at the empty bar and steps without gaps larger than the smallest increment claims", () => {
    const weights = loadableWeights("ohio_bar");
    expect(weights[0]).toBe(45);
    const inc = smallestIncrement("ohio_bar");
    expect(inc).toBe(2.5);
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
