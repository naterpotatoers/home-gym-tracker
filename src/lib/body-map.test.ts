import { describe, expect, it } from "vitest";
import { bodyMap } from "./body-map";
import { muscles } from "./data/muscles";

describe("bodyMap", () => {
  it("maps every muscle to at least one region", () => {
    for (const muscle of muscles) {
      const regions = bodyMap[muscle.id];
      expect(regions, muscle.id).toBeDefined();
      expect(regions.length, muscle.id).toBeGreaterThan(0);
    }
  });

  it("keeps each muscle on exactly one view (front or back)", () => {
    for (const muscle of muscles) {
      const views = new Set(bodyMap[muscle.id].map((r) => r.view));
      expect(views.size, muscle.id).toBe(1);
    }
  });

  it("every region has a non-empty path", () => {
    for (const muscle of muscles) {
      for (const region of bodyMap[muscle.id]) {
        expect(region.d.length, muscle.id).toBeGreaterThan(0);
      }
    }
  });
});
