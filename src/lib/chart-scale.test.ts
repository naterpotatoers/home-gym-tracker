import { describe, expect, it } from "vitest";
import { niceYScale } from "./chart-scale";

describe("niceYScale", () => {
  it("snaps outward to a nice step covering every value", () => {
    const s = niceYScale([183, 201, 214]);
    expect(s.step).toBe(10);
    expect(s.min).toBe(180);
    expect(s.max).toBe(220);
    expect(s.grid).toEqual([180, 190, 200, 210, 220]);
  });

  it("gives a flat series a visible band", () => {
    const s = niceYScale([200, 200]);
    expect(s.min).toBeLessThan(200);
    expect(s.max).toBeGreaterThan(200);
  });

  it("falls back to round hundreds for very wide ranges", () => {
    const s = niceYScale([100, 2100]);
    expect(s.step).toBe(500);
    expect(s.min).toBe(0);
    expect(s.max).toBe(2500);
  });
});
