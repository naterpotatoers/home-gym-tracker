import { describe, expect, it } from "vitest";
import { coverageStatus, volumeStatus } from "./coverage";

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

describe("volumeStatus", () => {
  it("untrained is neglected", () => {
    expect(volumeStatus({ weightedVolumeLbs: 0, ordinalReps: 0, peakScore: 10 }, 100)).toBe(
      "neglected",
    );
  });

  it("ordinal-only work is light, never neglected — even with low peak score", () => {
    expect(volumeStatus({ weightedVolumeLbs: 0, ordinalReps: 40, peakScore: 3 }, 100)).toBe(
      "light",
    );
  });

  it("relative banding at 25% of max", () => {
    expect(volumeStatus({ weightedVolumeLbs: 24, ordinalReps: 0, peakScore: 10 }, 100)).toBe(
      "light",
    );
    expect(volumeStatus({ weightedVolumeLbs: 26, ordinalReps: 0, peakScore: 10 }, 100)).toBe(
      "solid",
    );
  });

  it("indirect-only muscles stay neglected when loaded", () => {
    expect(volumeStatus({ weightedVolumeLbs: 90, ordinalReps: 0, peakScore: 4 }, 100)).toBe(
      "neglected",
    );
  });
});
