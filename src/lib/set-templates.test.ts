import { describe, expect, it } from "vitest";
import { seedSnapshot } from "./data/seed-snapshot";
import { availableVariants } from "./queries";
import { defaultPrescription, freshSets } from "./set-templates";

const data = seedSnapshot();
const variants = availableVariants(data);
const lift = variants.find((v) => v.pattern !== "mobility" && v.metricType === "reps")!;
const stretch = variants.find((v) => v.pattern === "mobility")!;
const hold = variants.find((v) => v.metricType === "time")!;
const noLoad = { weightLbs: null, addedWeightLbs: null, bandId: null, bandRole: null };
const bike = variants.find((v) => v.pattern === "conditioning")!;

describe("defaultPrescription", () => {
  it("lifts: 3 × 10 at RIR 2, 90 s rest", () => {
    expect(defaultPrescription("r", lift, 4)).toMatchObject({
      routineId: "r",
      order: 4,
      sets: 3,
      repMin: 10,
      repMax: 10,
      restSeconds: 90,
      targetRir: 2,
    });
  });
  it("stretches: one set, short rest, no RIR", () => {
    expect(defaultPrescription("r", stretch, 1)).toMatchObject({ sets: 1, restSeconds: 15, targetRir: null });
  });
  it("timed work defaults to a 30 s hold", () => {
    expect(defaultPrescription("r", hold, 1).durationSeconds).toBe(30);
  });
});

describe("freshSets", () => {
  let n = 0;
  const newSetId = () => `sl_${++n}`;

  it("numbers sets from the given position and applies the prefill", () => {
    const sets = freshSets({
      sessionId: "s",
      variant: lift,
      prefill: { ...noLoad, weightLbs: 95 },
      count: 3,
      position: 7,
      newSetId,
    });
    expect(sets.map((s) => [s.position, s.setNumber])).toEqual([[7, 1], [8, 2], [9, 3]]);
    expect(sets.every((s) => s.weightLbs === 95 && s.reps === 10 && !s.completed)).toBe(true);
    expect(new Set(sets.map((s) => s.id)).size).toBe(3);
  });

  it("a prescription supplies reps, time and band role", () => {
    const rx = { ...defaultPrescription("r", lift, 1), repMin: 6, repMax: 8, bandRole: "assistance" as const };
    const [set] = freshSets({ sessionId: "s", variant: lift, prefill: noLoad, count: 1, position: 1, rx, newSetId });
    expect(set.reps).toBe(8);
    expect(set.bandRole).toBe("assistance");
    const [timed] = freshSets({ sessionId: "s", variant: hold, prefill: noLoad, count: 1, position: 1, newSetId });
    expect(timed).toMatchObject({ reps: null, durationSeconds: 30 });
  });
});

describe("conditioning", () => {
  const newSetId = () => "sl_bike";
  it("a new bike row is one steady 5:00 piece, a minute's rest, no reps or RIR", () => {
    expect(defaultPrescription("r", bike, 1)).toMatchObject({
      sets: 1,
      repMin: null,
      repMax: null,
      durationSeconds: 300,
      restSeconds: 60,
      targetRir: null,
    });
  });
  it("a fresh piece carries the person's target and the scheme's length", () => {
    const target = { intervalScheme: "8x20/10", targetWatts: null, targetRpm: 55 };
    const [set] = freshSets({ sessionId: "s", variant: bike, prefill: { ...noLoad, target }, count: 1, position: 1, newSetId });
    expect(set).toMatchObject({ reps: null, durationSeconds: 240, conditioning: { ...target, avgRpm: null } });
    expect(set).not.toHaveProperty("target");
  });
  it("strength sets never get a conditioning block", () => {
    const [set] = freshSets({ sessionId: "s", variant: lift, prefill: noLoad, count: 1, position: 1, newSetId });
    expect(set.conditioning).toBeNull();
  });
});
