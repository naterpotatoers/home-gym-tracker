import { describe, expect, it } from "vitest";
import { coverageStatus } from "./coverage";

describe("coverageStatus", () => {
  const base = { muscleId: "quads" as const, exerciseIds: [] };

  it("thresholds at 2 and 6 weighted sets", () => {
    expect(coverageStatus({ ...base, weightedSets: 1.9, peakScore: 10 })).toBe("neglected");
    expect(coverageStatus({ ...base, weightedSets: 2, peakScore: 10 })).toBe("light");
    expect(coverageStatus({ ...base, weightedSets: 5.9, peakScore: 10 })).toBe("light");
    expect(coverageStatus({ ...base, weightedSets: 6, peakScore: 10 })).toBe("solid");
  });

  it("neglected when nothing hits the muscle directly, regardless of volume", () => {
    expect(coverageStatus({ ...base, weightedSets: 20, peakScore: 4 })).toBe("neglected");
  });
});

