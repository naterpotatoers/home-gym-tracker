import { describe, expect, it } from "vitest";
import { seedSnapshot } from "./data/seed-snapshot";
import { blocksFor } from "./queries";
import { cascadePatch, cascadeTargets, renumber, toBlocks } from "./set-blocks";
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
