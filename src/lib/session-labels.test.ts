import { describe, expect, it } from "vitest";
import {
  advanceCursor,
  nextIncomplete,
  performOrder,
  resolveCursor,
  rxLabel,
  supersetGroups,
} from "./session-labels";
import type { RoutineExercise, SetLog } from "./types";

const set = (id: string, completed: boolean) => ({ id, completed }) as SetLog;

describe("nextIncomplete (forward-only cursor scan)", () => {
  it("finds the next incomplete at or after `from`", () => {
    expect(nextIncomplete([set("a", true), set("b", false), set("c", false)], 1)).toBe(1);
    expect(nextIncomplete([set("a", true), set("b", true), set("c", false)], 1)).toBe(2);
  });

  it("does not wrap: skipped earlier sets stay behind", () => {
    expect(nextIncomplete([set("a", false), set("b", true), set("c", true)], 1)).toBe(-1);
  });

  it("returns -1 when everything is done", () => {
    expect(nextIncomplete([set("a", true), set("b", true)], 0)).toBe(-1);
    expect(nextIncomplete([], 0)).toBe(-1);
  });
});

describe("resolveCursor (id-based)", () => {
  // Exercise A (a1, a2) skipped; exercise B (b1, b2) is where the workout is.
  const skipScenario = [set("a1", false), set("a2", false), set("b1", true), set("b2", false)];

  it("stays on the cursor set while it is incomplete", () => {
    expect(resolveCursor(skipScenario, "b2")?.id).toBe("b2");
  });

  it("does not jump back to a skipped exercise when the cursor set completes", () => {
    const done = [set("a1", false), set("a2", false), set("b1", true), set("b2", true)];
    expect(resolveCursor(done, "b2")).toBeNull();
  });

  it("heals forward (not to index 0) when the cursor set completed mid-list", () => {
    const sets = [set("a1", false), set("b1", true), set("c1", false)];
    expect(resolveCursor(sets, "b1")?.id).toBe("c1");
  });

  it("parks (null) when the cursor id is gone or was never aimed", () => {
    const sets = [set("a1", false), set("c1", false)];
    expect(resolveCursor(sets, "b1-removed")).toBeNull();
    expect(resolveCursor(sets, null)).toBeNull();
  });

  it("self-recovers forward when sets are appended past a completed cursor", () => {
    const sets = [set("a1", false), set("b1", true), set("new1", false)];
    expect(resolveCursor(sets, "b1")?.id).toBe("new1");
  });

  it("returns null when everything is done", () => {
    expect(resolveCursor([set("a1", true)], "a1")).toBeNull();
    expect(resolveCursor([], null)).toBeNull();
  });
});

describe("advanceCursor", () => {
  it("moves to the next incomplete set after the logged one", () => {
    const sets = [set("a1", false), set("a2", false), set("a3", false)];
    expect(advanceCursor(sets, "a1")).toBe("a2");
  });

  it("skips completed sets ahead", () => {
    const sets = [set("a1", false), set("a2", true), set("a3", false)];
    expect(advanceCursor(sets, "a1")).toBe("a3");
  });

  it("never wraps to skipped sets behind", () => {
    const sets = [set("a1", false), set("b1", false)];
    expect(advanceCursor(sets, "b1")).toBeNull();
  });

  it("returns null for an unknown id", () => {
    expect(advanceCursor([set("a1", false)], "nope")).toBeNull();
  });
});

describe("supersets (performOrder + cursor)", () => {
  // Typed loosely on purpose — only the fields the helpers read.
  const vset = (id: string, exerciseId: string, completed = false) =>
    ({ id, exerciseId, modalityId: "dumbbell", completed }) as SetLog;
  const rx = (exerciseId: string, supersetGroup: string | null) =>
    ({ exerciseId, modalityId: "dumbbell", supersetGroup }) as RoutineExercise;

  // Stored grouped: A A A, B B, C C (A+B paired as "arms", C solo)
  const stored = [
    vset("a1", "bicep_curl"), vset("a2", "bicep_curl"), vset("a3", "bicep_curl"),
    vset("b1", "tricep_extension"), vset("b2", "tricep_extension"),
    vset("c1", "shrug"), vset("c2", "shrug"),
  ];
  const groups = supersetGroups([
    rx("bicep_curl", "arms"),
    rx("tricep_extension", "arms"),
    rx("shrug", null),
  ]);

  it("supersetGroups keeps only labeled prescriptions", () => {
    expect(groups.size).toBe(2);
    expect(groups.get("bicep_curl|dumbbell")).toBe("arms");
    expect(groups.get("shrug|dumbbell")).toBeUndefined();
  });

  it("interleaves paired blocks round by round; unequal counts degrade", () => {
    expect(performOrder(stored, groups).map((s) => s.id)).toEqual([
      "a1", "b1", "a2", "b2", "a3", "c1", "c2",
    ]);
  });

  it("is identity with no labels", () => {
    expect(performOrder(stored, new Map()).map((s) => s.id)).toEqual(
      stored.map((s) => s.id),
    );
  });

  it("non-adjacent same-label blocks do not merge", () => {
    const spread = [
      vset("a1", "bicep_curl"), vset("a2", "bicep_curl"),
      vset("c1", "shrug"),
      vset("b1", "tricep_extension"), vset("b2", "tricep_extension"),
    ];
    expect(performOrder(spread, groups).map((s) => s.id)).toEqual([
      "a1", "a2", "c1", "b1", "b2",
    ]);
  });

  it("the cursor walks the interleaved order: A1 → B1 → A2", () => {
    const ordered = performOrder(stored, groups);
    expect(resolveCursor(ordered, null)).toBeNull(); // parked stays parked
    expect(advanceCursor(ordered, "a1")).toBe("b1");
    expect(advanceCursor(ordered, "b1")).toBe("a2");
    expect(advanceCursor(ordered, "a3")).toBe("c1");
  });

  it("stays forward-only over the interleaved order", () => {
    const done = performOrder(
      stored.map((s) => (s.id === "c2" ? s : { ...s, completed: true })),
      groups,
    );
    // everything before c2 skipped/completed; cursor on c2 resolves to itself
    expect(resolveCursor(done, "c2")?.id).toBe("c2");
    expect(advanceCursor(done, "c2")).toBeNull();
  });
});

describe("rxLabel", () => {
  const rx = (o: Partial<RoutineExercise>) =>
    ({
      sets: 3,
      repMin: 10,
      repMax: 10,
      durationSeconds: null,
      targetRir: 2,
      restSeconds: 90,
      ...o,
    }) as RoutineExercise;

  it("collapses equal rep ranges", () => {
    expect(rxLabel(rx({}))).toBe("3×10 @ RIR 2 · rest 90s");
  });

  it("keeps genuine ranges and timed schemes", () => {
    expect(rxLabel(rx({ repMin: 8, repMax: 12 }))).toBe("3×8–12 @ RIR 2 · rest 90s");
    expect(rxLabel(rx({ durationSeconds: 30, targetRir: null }))).toBe("3×30s · rest 90s");
  });
});
