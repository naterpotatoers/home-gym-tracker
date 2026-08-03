import { describe, expect, it } from "vitest";
import { nextIncomplete, rxLabel } from "./session-labels";
import type { RoutineExercise, SetLog } from "./types";

const set = (completed: boolean) => ({ completed }) as SetLog;

describe("nextIncomplete (self-healing cursor)", () => {
  it("finds the next incomplete at or after `from`", () => {
    expect(nextIncomplete([set(true), set(false), set(false)], 1)).toBe(1);
    expect(nextIncomplete([set(true), set(true), set(false)], 1)).toBe(2);
  });

  it("wraps around once", () => {
    expect(nextIncomplete([set(false), set(true), set(true)], 1)).toBe(0);
  });

  it("returns -1 when everything is done", () => {
    expect(nextIncomplete([set(true), set(true)], 0)).toBe(-1);
    expect(nextIncomplete([], 0)).toBe(-1);
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
