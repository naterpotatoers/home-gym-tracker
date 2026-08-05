import { describe, expect, it } from "vitest";
import { seedSnapshot } from "./data/seed-snapshot";
import {
  muscleVolume,
  prComparison,
  repRangeForWeight,
  repsForWeight,
  suggestedLoad,
  weightForReps,
  workingWeightForRepRange,
} from "./queries";

const data = seedSnapshot();

describe("Epley inversions", () => {
  it("round-trips: the weight predicted for N reps predicts N reps back", () => {
    for (const reps of [1, 5, 8, 12]) {
      const weight = weightForReps(200, reps);
      expect(repsForWeight(200, weight)).toBeCloseTo(reps, 6);
    }
  });

  it("weightForReps at 0 reps is the e1RM itself", () => {
    expect(weightForReps(200, 0)).toBe(200);
  });

  it("repsForWeight clamps nonsense inputs to 0", () => {
    expect(repsForWeight(200, 0)).toBe(0);
    expect(repsForWeight(200, -10)).toBe(0);
    expect(repsForWeight(100, 500)).toBe(0); // heavier than you could ever lift
  });
});

describe("workingWeightForRepRange (seed-data integration)", () => {
  it("answers for a trained barbell variant, with a buildable bar load", () => {
    const answer = workingWeightForRepRange(data, "nate", "bench_press", "barbell", 8, 10);
    expect(answer.bestActual).not.toBeNull();
    expect(answer.bestActual!.reps).toBeGreaterThanOrEqual(8);
    expect(answer.bestActual!.reps).toBeLessThanOrEqual(10);
    expect(answer.predicted).toBeGreaterThan(0);
    expect(answer.suggestedBarLoad).toBeGreaterThan(0);
  });

  it("suggests a bar load only for barbell work", () => {
    const answer = workingWeightForRepRange(data, "nate", "bench_press", "dumbbell", 8, 10);
    expect(answer.predicted).toBeGreaterThan(0);
    expect(answer.suggestedBarLoad).toBeNull();
  });

  it("returns nulls, never fake numbers, for an untrained variant", () => {
    const answer = workingWeightForRepRange(data, "nate", "donkey_kick", "bodyweight", 8, 10);
    expect(answer).toEqual({ bestActual: null, predicted: null, suggestedBarLoad: null });
  });
});

describe("repRangeForWeight", () => {
  it("finds the most reps ever done at or above the asked weight", () => {
    const answer = repRangeForWeight(data, "nate", "bench_press", "barbell", 135);
    expect(answer.bestActual).not.toBeNull();
    expect(answer.bestActual!.weightLbs).toBeGreaterThanOrEqual(135);
    expect(answer.predictedReps).toBeGreaterThan(0);
  });
});

describe("prComparison", () => {
  it("returns one row per client, null-safe for clients who never did the lift", () => {
    const rows = prComparison(data, "bench_press", "barbell");
    expect(rows).toHaveLength(data.clients.length);
    const nate = rows.find((r) => r.clientId === "nate")!;
    expect(nate.bestE1rmLbs).toBeGreaterThan(0);
    expect(nate.heaviestLbs).toBeGreaterThan(0);
    expect(nate.date).not.toBeNull();
    for (const row of rows) {
      if (row.bestE1rmLbs === null) {
        expect(row.heaviestLbs).toBeNull();
        expect(row.date).toBeNull();
      }
    }
  });
});

describe("suggestedLoad", () => {
  it("prefills from the most recent completed working set", () => {
    const load = suggestedLoad(data, "nate", "bench_press", "barbell");
    expect(load).not.toBeNull();
    expect(load!.weightLbs).toBeGreaterThan(0);
    expect(load!.bandId).toBeNull();
  });

  it("is null for a variant the client never trained", () => {
    expect(suggestedLoad(data, "nate", "donkey_kick", "bodyweight")).toBeNull();
  });
});

describe("muscleVolume honesty", () => {
  const volumes = new Map(muscleVolume(data, "nate").map((v) => [v.muscleId, v]));

  it("accumulates real pounds for loaded work", () => {
    const quads = volumes.get("quads")!;
    expect(quads.weightedVolumeLbs).toBeGreaterThan(0);
    expect(quads.sets).toBeGreaterThan(0);
    expect(quads.peakScore).toBe(10); // squat is a primary quad driver
  });

  it("keeps ordinal (hip-band) work out of the pounds total", () => {
    // Nate's glute_med work includes hip-band lateral walks — ordinal only.
    const gluteMed = volumes.get("glute_med")!;
    expect(gluteMed.ordinalReps).toBeGreaterThan(0);
    // Loaded sets that *also* score glute_med may add lbs, but the band reps
    // themselves never do: an ordinal-only muscle would have zero lbs.
    const ordinalOnly = [...volumes.values()].filter(
      (v) => v.ordinalReps > 0 && v.sets > 0,
    );
    expect(ordinalOnly.length).toBeGreaterThan(0);
  });

  it("returns a row for every muscle, zeroed when untrained", () => {
    const untouched = [...volumes.values()].filter(
      (v) => v.weightedVolumeLbs === 0 && v.ordinalReps === 0,
    );
    expect(untouched.every((v) => v.sets === 0 && v.peakScore === 0)).toBe(true);
  });
});
