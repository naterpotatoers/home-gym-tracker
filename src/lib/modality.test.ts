import { describe, expect, it } from "vitest";
import { seedSnapshot } from "./data/seed-snapshot";
import { bestE1rm, e1rm, latestBodyweight, normalizedLoad, setLoad } from "./modality";
import { workingSets } from "./queries";

const data = seedSnapshot();

function firstSet(predicate: (s: (typeof data.setLogs)[number]) => boolean) {
  const set = data.setLogs.find(predicate);
  if (!set) throw new Error("seed data changed — no set matches");
  return set;
}

describe("setLoad", () => {
  it("barbell: exact pounds as recorded", () => {
    const set = firstSet((s) => s.modalityId === "barbell" && s.weightLbs !== null);
    const load = setLoad(data, set);
    expect(load.lbs).toBe(set.weightLbs);
    expect(load.precision).toBe("exact");
  });

  it("dumbbell bilateral: total = per-implement × 2", () => {
    const set = firstSet(
      (s) =>
        s.modalityId === "dumbbell" &&
        s.weightLbs !== null &&
        s.unilateralMode === "bilateral",
    );
    expect(setLoad(data, set).lbs).toBe(set.weightLbs! * 2);
  });

  it("hip-band work is ordinal with no pound value", () => {
    const set = firstSet((s) => s.bandId?.startsWith("hip_band") ?? false);
    const load = setLoad(data, set);
    expect(load.precision).toBe("ordinal");
    expect(load.lbs).toBeNull();
  });

  it("band assistance subtracts from bodyweight, never below zero", () => {
    const set = firstSet((s) => s.bandRole === "assistance" && s.bandId !== null);
    const session = data.sessionById.get(set.sessionId)!;
    const bw = latestBodyweight(data, session.clientId, session.date);
    const load = setLoad(data, set);
    expect(bw).not.toBeNull();
    expect(load.lbs).not.toBeNull();
    expect(load.lbs!).toBeLessThan(bw!);
    expect(load.lbs!).toBeGreaterThanOrEqual(0);
  });

  it("per-side reps double totalReps for non-bilateral work", () => {
    const set = firstSet((s) => s.unilateralMode !== "bilateral" && s.reps !== null);
    expect(setLoad(data, set).totalReps).toBe(set.reps! * 2);
  });
});

describe("e1rm", () => {
  it("is Epley over the set load", () => {
    const set = firstSet(
      (s) =>
        s.modalityId === "barbell" &&
        s.weightLbs !== null &&
        s.reps !== null &&
        s.reps > 0 &&
        !s.isWarmup,
    );
    const expected = set.weightLbs! * (1 + set.reps! / 30);
    expect(e1rm(data, set)).toBeCloseTo(expected, 6);
  });

  it("returns null for warmups and ordinal loads", () => {
    const warmup = data.setLogs.find((s) => s.isWarmup && s.weightLbs !== null);
    if (warmup) expect(e1rm(data, warmup)).toBeNull();
    const hip = firstSet((s) => s.bandId?.startsWith("hip_band") ?? false);
    expect(e1rm(data, hip)).toBeNull();
  });

  it("bestE1rm over an empty list is null", () => {
    expect(bestE1rm(data, [])).toBeNull();
  });
});

describe("normalizedLoad", () => {
  it("equals raw load for barbell (factor 1)", () => {
    const sets = workingSets(data, "nate", "bench_press", "barbell");
    const set = sets[0];
    const load = setLoad(data, set);
    expect(normalizedLoad(data, set)).toBeCloseTo(load.lbs!, 6);
  });
});
