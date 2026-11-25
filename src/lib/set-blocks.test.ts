import { describe, expect, it } from "vitest";
import { seedSnapshot } from "./data/seed-snapshot";
import { blocksFor } from "./queries";
import { EMPTY_CONDITIONING } from "./conditioning";
import {
  cascadeInto,
  cascadePatch,
  cascadeTargets,
  completeAsBodyweight,
  nextSetLike,
  renumber,
  toBlocks,
} from "./set-blocks";
import type { SetLog } from "./types";

function stub(overrides: Partial<SetLog>): SetLog {
  return {
    id: "sl_x",
    sessionId: "s_x",
    exerciseId: "squat",
    modalityId: "barbell",
    position: 1,
    setNumber: 1,
    unilateralMode: "bilateral",
    side: null,
    reps: 5,
    weightLbs: 135,
    addedWeightLbs: null,
    bandId: null,
    bandRole: null,
    durationSeconds: null,
    distanceFeet: null,
    rir: null,
    isWarmup: false,
    completed: false,
    notes: "",
    conditioning: null,
    ...overrides,
  };
}

describe("renumber", () => {
  it("makes positions contiguous 1..n and restarts setNumber per block", () => {
    const sets = [
      stub({ id: "a", exerciseId: "squat", position: 4 }),
      stub({ id: "b", exerciseId: "squat", position: 9 }),
      stub({ id: "c", exerciseId: "bench_press", position: 12 }),
      stub({ id: "d", exerciseId: "squat", position: 20 }),
    ];
    const out = renumber(sets);
    expect(out.map((s) => s.position)).toEqual([1, 2, 3, 4]);
    expect(out.map((s) => s.setNumber)).toEqual([1, 2, 1, 1]);
  });

  it("survives deleting a middle set", () => {
    const sets = [
      stub({ id: "a", position: 1, setNumber: 1 }),
      stub({ id: "b", position: 2, setNumber: 2 }),
      stub({ id: "c", position: 3, setNumber: 3 }),
    ];
    const out = renumber(sets.filter((s) => s.id !== "b"));
    expect(out.map((s) => s.position)).toEqual([1, 2]);
    expect(out.map((s) => s.setNumber)).toEqual([1, 2]);
  });

  it("splits mid-session modality switches into separate numbering runs", () => {
    const sets = [
      stub({ id: "a", modalityId: "barbell", position: 1 }),
      stub({ id: "b", modalityId: "dumbbell", position: 2 }),
      stub({ id: "c", modalityId: "barbell", position: 3 }),
    ];
    const out = renumber(sets);
    expect(out.map((s) => s.setNumber)).toEqual([1, 1, 1]);
  });
});

describe("toBlocks", () => {
  it("groups consecutive runs, not global exercise identity", () => {
    const sets = [
      stub({ id: "a", exerciseId: "bench_press", modalityId: "barbell", position: 1 }),
      stub({ id: "b", exerciseId: "bench_press", modalityId: "dumbbell", position: 2 }),
      stub({ id: "c", exerciseId: "bench_press", modalityId: "barbell", position: 3 }),
    ];
    const blocks = toBlocks(sets);
    expect(blocks).toHaveLength(3);
  });

  it("agrees with blocksFor on every seed session", () => {
    const data = seedSnapshot();
    for (const session of data.sessions) {
      const viaQuery = blocksFor(data, session.id);
      const viaBlocks = toBlocks(data.setsBySession.get(session.id) ?? []);
      expect(viaBlocks.map((b) => ({ e: b.exerciseId, m: b.modalityId, n: b.sets.length }))).toEqual(
        viaQuery.map((b) => ({ e: b.exerciseId, m: b.modalityId, n: b.sets.length })),
      );
    }
  });
});

describe("toBlocks keys", () => {
  it("survive removing an earlier block", () => {
    const sets = [
      stub({ id: "a", exerciseId: "squat" }),
      stub({ id: "b", exerciseId: "bench_press" }),
      stub({ id: "c", exerciseId: "deadlift" }),
    ];
    const before = toBlocks(sets).map((b) => b.key);
    const after = toBlocks(sets.slice(1)).map((b) => b.key);
    expect(after).toEqual(before.slice(1));
  });
});

describe("cascadeTargets", () => {
  const block = (states: Partial<SetLog>[]) =>
    states.map((o, i) => stub({ id: `s${i + 1}`, position: i + 1, setNumber: i + 1, ...o }));

  it("rolls a reps edit forward to every later pending set", () => {
    const sets = block([{}, {}, {}]);
    expect(cascadeTargets(sets, "s1", { reps: 8 })).toEqual(["s2", "s3"]);
  });

  it("cascades from an already-logged set while the later sets are pending", () => {
    const sets = block([{ completed: true }, {}, {}]);
    expect(cascadeTargets(sets, "s1", { weightLbs: 145, reps: 6 })).toEqual(["s2", "s3"]);
  });

  it("stops at the first completed set", () => {
    const sets = block([{ completed: true }, { completed: true }, {}]);
    expect(cascadeTargets(sets, "s1", { reps: 6 })).toEqual([]);
    const mid = block([{}, {}, { completed: true }, {}]);
    expect(cascadeTargets(mid, "s1", { reps: 6 })).toEqual(["s2"]);
  });

  it("never crosses into another exercise block", () => {
    const sets = [
      ...block([{}, {}]),
      stub({ id: "o1", exerciseId: "bench_press", position: 3 }),
    ];
    expect(cascadeTargets(sets, "s1", { reps: 6 })).toEqual(["s2"]);
  });

  it("keeps warm-ups and working sets apart", () => {
    const sets = block([{ isWarmup: true }, { isWarmup: true }, {}, {}]);
    expect(cascadeTargets(sets, "s1", { weightLbs: 95 })).toEqual(["s2"]);
    expect(cascadeTargets(sets, "s3", { weightLbs: 185 })).toEqual(["s4"]);
  });

  it("covers both sides of unilateral work", () => {
    const sets = block([
      { side: "left", unilateralMode: "alternating" },
      { side: "right", unilateralMode: "alternating" },
      { side: "left", unilateralMode: "alternating" },
    ]);
    expect(cascadeTargets(sets, "s1", { reps: 12 })).toEqual(["s2", "s3"]);
  });

  it("ignores non-prescription fields", () => {
    const sets = block([{}, {}]);
    expect(cascadeTargets(sets, "s1", { completed: true })).toEqual([]);
    expect(cascadeTargets(sets, "s1", { notes: "felt easy", rir: 2 })).toEqual([]);
    expect(cascadePatch({ reps: 5, notes: "x", completed: true })).toEqual({ reps: 5 });
  });
});

describe("bike pieces cascade their plan, never their readout", () => {
  const bike = (id: string, position: number, overrides: Partial<SetLog> = {}) =>
    stub({
      id,
      position,
      setNumber: position,
      exerciseId: "echo_bike",
      modalityId: "cardio",
      reps: null,
      weightLbs: null,
      durationSeconds: 240,
      conditioning: { ...EMPTY_CONDITIONING, intervalScheme: "8x20/10", targetWatts: 200 },
      ...overrides,
    });
  const sets = [bike("p1", 1), bike("p2", 2), bike("p3", 3)];
  const withLog = (changes: Partial<SetLog["conditioning"] & object>) => ({
    conditioning: { ...sets[0].conditioning!, ...changes },
  });

  it("a new target reaches the pieces still to ride", () => {
    const changes = withLog({ targetWatts: 250 });
    expect(cascadeTargets(sets, "p1", changes)).toEqual(["p2", "p3"]);
    expect(cascadeInto(sets[1], changes).conditioning).toMatchObject({ intervalScheme: "8x20/10", targetWatts: 250 });
  });

  it("a new piece shape brings its scheme and its length together", () => {
    const changes = { ...withLog({ intervalScheme: "10x30/30" }), durationSeconds: 600 };
    expect(cascadeTargets(sets, "p1", changes)).toEqual(["p2", "p3"]);
    expect(cascadeInto(sets[1], changes)).toMatchObject({
      durationSeconds: 600,
      conditioning: { intervalScheme: "10x30/30", targetWatts: 200 },
    });
  });

  it("what the console read stays on its own piece", () => {
    expect(cascadeTargets(sets, "p1", withLog({ avgWatts: 171, effort: 6 }))).toEqual([]);
    expect(cascadeTargets(sets, "p1", { distanceFeet: 4752 })).toEqual([]);
    // Even alongside a target change, a later piece keeps its own readout.
    const later = bike("p2", 2, { distanceFeet: 5000, conditioning: { ...sets[1].conditioning!, avgWatts: 150 } });
    const next = cascadeInto(later, { ...withLog({ targetWatts: 250, avgWatts: 171 }), distanceFeet: 4752 });
    expect(next.distanceFeet).toBe(5000);
    expect(next.conditioning).toMatchObject({ targetWatts: 250, avgWatts: 150 });
  });

  it("Add piece copies the plan, not the ride", () => {
    const ridden = bike("p1", 1, {
      completed: true,
      distanceFeet: 4752,
      conditioning: { ...sets[0].conditioning!, avgWatts: 171, maxWatts: 310, calories: 33, effort: 6 },
    });
    expect(nextSetLike(ridden, "p2")).toMatchObject({
      id: "p2",
      completed: false,
      durationSeconds: 240,
      distanceFeet: null,
      conditioning: { ...EMPTY_CONDITIONING, intervalScheme: "8x20/10", targetWatts: 200 },
    });
    expect(nextSetLike(ridden, "p2").conditioning).not.toHaveProperty("effort");
    // A lift's next set is the last one again, not yet done.
    expect(nextSetLike(stub({ id: "s1", completed: true, weightLbs: 145, reps: 6 }), "s2")).toMatchObject({
      id: "s2",
      completed: false,
      weightLbs: 145,
      reps: 6,
    });
  });

  it("a lift still takes the plain prescription fields", () => {
    expect(cascadeInto(stub({ id: "s2" }), { weightLbs: 145, reps: 6, notes: "x" })).toMatchObject({
      weightLbs: 145,
      reps: 6,
      notes: "",
    });
  });
});

describe("completeAsBodyweight", () => {
  const yes = () => true;
  const db = (id: string, weightLbs: number | null, completed = false) =>
    stub({ id, exerciseId: "calf_raise", modalityId: "dumbbell", weightLbs, completed });

  it("a 0 lb dumbbell set logs as bodyweight, with the block's other 0 lb sets", () => {
    const sets = [db("a", 0), db("b", 0), db("c", 0), stub({ id: "d" })];
    const out = completeAsBodyweight(sets, "a", yes)!;
    expect(out.slice(0, 3).map((s) => [s.modalityId, s.weightLbs, s.completed])).toEqual([
      ["bodyweight", null, true],
      ["bodyweight", null, false],
      ["bodyweight", null, false],
    ]);
    expect(out[3]).toBe(sets[3]);
    expect(toBlocks(out)).toHaveLength(2); // still one calf-raise block
  });

  it("leaves real weights alone", () => {
    const out = completeAsBodyweight([db("a", 0), db("b", 25)], "a", yes)!;
    expect(out[1]).toMatchObject({ modalityId: "dumbbell", weightLbs: 25 });
  });

  it("doesn't apply: real weight, blank weight, bands, or no bodyweight variant", () => {
    expect(completeAsBodyweight([db("a", 10)], "a", yes)).toBeNull();
    expect(completeAsBodyweight([db("a", null)], "a", yes)).toBeNull();
    expect(completeAsBodyweight([stub({ id: "a", modalityId: "band", weightLbs: 0 })], "a", yes)).toBeNull();
    expect(completeAsBodyweight([db("a", 0)], "a", () => false)).toBeNull();
  });
});
