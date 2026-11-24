import { describe, expect, it } from "vitest";
import { seedSnapshot } from "./data/seed-snapshot";
import { catalogSlice } from "./exercise-catalog";
import { availableVariants, type Variant } from "./queries";
import {
  advanceCursor,
  blockSupersetLabel,
  cursorOrder,
  performOrder,
  resolveCursor,
  restAfterLog,
  supersetGroups,
} from "./session-labels";
import { cascadeTargets, renumber, sameBlock, toBlocks } from "./set-blocks";
import { swappedSet } from "./set-templates";
import type { RoutineExercise, SetLog } from "./types";
import { BIKE_WARMUP_RX, dropUnloggedBikeWarmups, isBikeWarmupBlock } from "./warmup";

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

const bike = (id: string, overrides: Partial<SetLog> = {}) =>
  stub({
    id,
    exerciseId: "echo_bike",
    modalityId: "cardio",
    reps: null,
    weightLbs: null,
    durationSeconds: 240,
    conditioning: {
      intervalScheme: "8x20/10",
      targetWatts: 120,
      targetRpm: null,
      avgWatts: null,
      maxWatts: null,
      avgRpm: null,
      calories: null,
    },
    ...overrides,
  });

const variants = availableVariants(catalogSlice(seedSnapshot()));
function variant(exerciseId: string, modalityId: string): Variant {
  const v = variants.find(
    (x) => x.exerciseModality.exerciseId === exerciseId && x.exerciseModality.modalityId === modalityId,
  );
  if (!v) throw new Error(`no variant ${exerciseId}|${modalityId}`);
  return v;
}
const noLoad = { weightLbs: null, addedWeightLbs: null, bandId: null, bandRole: null };

describe("bike warm-up blocks", () => {
  const sets = [
    bike("w", { isWarmup: true }),
    bike("f1"),
    bike("f2"),
    stub({ id: "s1" }),
    stub({ id: "s2", isWarmup: true }),
    stub({ id: "s3" }),
  ];

  it("never merges the warm-up with an Echo piece right after it", () => {
    const blocks = toBlocks(sets);
    expect(blocks.map((b) => b.sets.map((s) => s.id))).toEqual([["w"], ["f1", "f2"], ["s1", "s2", "s3"]]);
    expect(isBikeWarmupBlock(blocks[0])).toBe(true);
    expect(isBikeWarmupBlock(blocks[1])).toBe(false);
  });

  it("keeps a strength set toggled to warm-up in its exercise's block", () => {
    expect(sameBlock(sets[3], sets[4])).toBe(true);
  });

  it("restarts setNumber at the split and keeps positions 1..n", () => {
    const out = renumber(sets);
    expect(out.map((s) => s.position)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(out.map((s) => s.setNumber)).toEqual([1, 1, 2, 1, 2, 3]);
  });

  it("never cascades a warm-up edit into the finisher", () => {
    expect(cascadeTargets(sets, "w", { durationSeconds: 300 })).toEqual([]);
  });
});

describe("dropUnloggedBikeWarmups", () => {
  it("drops only an unlogged bike warm-up", () => {
    const sets = [
      bike("w", { isWarmup: true }),
      stub({ id: "sq_warm", isWarmup: true }),
      stub({ id: "nordic", exerciseId: "nordic_curl", modalityId: "bodyweight" }),
      bike("f"),
    ];
    expect(dropUnloggedBikeWarmups(sets).map((s) => s.id)).toEqual(["sq_warm", "nordic", "f"]);
  });

  it("keeps a logged warm-up and returns the same array when nothing drops", () => {
    const sets = [bike("w", { isWarmup: true, completed: true }), stub({ id: "s" })];
    expect(dropUnloggedBikeWarmups(sets)).toBe(sets);
  });
});

describe("swappedSet", () => {
  it("a swapped bike warm-up is real work: no warm-up flag, no piece fields", () => {
    const out = swappedSet(bike("w", { isWarmup: true }), variant("goblet_squat", "dumbbell"), {
      ...noLoad,
      weightLbs: 25,
    });
    expect(out).toMatchObject({
      exerciseId: "goblet_squat",
      modalityId: "dumbbell",
      isWarmup: false,
      conditioning: null,
      durationSeconds: null,
      distanceFeet: null,
      reps: 10,
      weightLbs: 25,
    });
  });

  it("a strength warm-up swapped to another lift stays a warm-up and keeps its reps", () => {
    const out = swappedSet(stub({ id: "s", isWarmup: true, reps: 5 }), variant("front_squat", "barbell"), noLoad);
    expect(out.isWarmup).toBe(true);
    expect(out.reps).toBe(5);
  });

  it("reps → hold gets a time instead of reps, hold → reps gets reps back", () => {
    const hold = swappedSet(stub({ id: "s", reps: 8 }), variant("plank", "bodyweight"), noLoad);
    expect(hold).toMatchObject({ reps: null, durationSeconds: 30 });
    const back = swappedSet(hold, variant("goblet_squat", "dumbbell"), noLoad);
    expect(back).toMatchObject({ reps: 10, durationSeconds: null });
  });

  it("lift → bike gets a 5:00 piece and the prefill's target", () => {
    const out = swappedSet(stub({ id: "s" }), variant("echo_bike", "cardio"), {
      ...noLoad,
      target: { intervalScheme: null, targetWatts: 150, targetRpm: null },
    });
    expect(out).toMatchObject({ reps: null, durationSeconds: 300, weightLbs: null });
    expect(out.conditioning?.targetWatts).toBe(150);
  });
});

describe("skipping blocks (cursorOrder)", () => {
  const vset = (id: string, exerciseId: string, completed = false) =>
    ({ id, exerciseId, modalityId: "dumbbell", completed, isWarmup: false }) as SetLog;
  const rx = (exerciseId: string, supersetGroup: string | null) =>
    ({ exerciseId, modalityId: "dumbbell", supersetGroup }) as RoutineExercise;
  const stored = [
    vset("a1", "bicep_curl"), vset("a2", "bicep_curl"),
    vset("b1", "tricep_extension"), vset("b2", "tricep_extension"),
    vset("c1", "shrug"),
  ];
  const groups = supersetGroups([rx("bicep_curl", "arms"), rx("tricep_extension", "arms")]);
  const ordered = performOrder(stored, groups); // a1 b1 a2 b2 c1

  it("is identity with nothing skipped", () => {
    expect(cursorOrder(ordered, new Set())).toBe(ordered);
  });

  it("skipping one superset member walks the other, never back", () => {
    const walk = cursorOrder(ordered, new Set(["a1", "a2"]));
    expect(walk.map((s) => s.id)).toEqual(["b1", "b2", "c1"]);
    expect(resolveCursor(walk, "b1")?.id).toBe("b1");
    expect(advanceCursor(walk, "b1")).toBe("b2");
    expect(advanceCursor(walk, "b2")).toBe("c1");
  });

  it("skipping the last block parks the cursor", () => {
    const walk = cursorOrder(ordered, new Set(["c1"]));
    expect(advanceCursor(walk, "b2")).toBeNull();
    expect(resolveCursor(walk, "c1")).toBeNull();
  });
});

describe("the bike warm-up and supersets", () => {
  const groups = supersetGroups([
    { exerciseId: "echo_bike", modalityId: "cardio", supersetGroup: "finish" } as RoutineExercise,
  ]);

  it("never takes an Echo row's superset label", () => {
    const warm = { exerciseId: "echo_bike", modalityId: "cardio" as const, sets: [bike("w", { isWarmup: true })] };
    const piece = { exerciseId: "echo_bike", modalityId: "cardio" as const, sets: [bike("f")] };
    expect(blockSupersetLabel(groups, warm)).toBeUndefined();
    expect(blockSupersetLabel(groups, piece)).toBe("finish");
  });

  it("rests the warm-up's own rest, not a superset's zero", () => {
    expect(restAfterLog(bike("w", { isWarmup: true }), bike("f"), [], groups)).toBe(BIKE_WARMUP_RX.restSeconds);
  });
});
