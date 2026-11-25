import { describe, expect, it } from "vitest";
import {
  advanceCursor,
  blockPrescription,
  blockRxLine,
  blockStall,
  prescriptionFor,
  supersetPosition,
  warmupRxLabel,
  compactSet,
  DEFAULT_REST_SECONDS,
  restAfterLog,
  loadLabel,
  stallChipLabel,
  nextIncomplete,
  performOrder,
  resolveCursor,
  rxLabel,
  supersetGroups,
  upcomingFoldIndex,
} from "./session-labels";
import type { RoutineExercise, SetLog } from "./types";
import { BIKE_WARMUP_RX } from "./warmup";
import { EMPTY_TARGET } from "./conditioning";

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

describe("upcomingFoldIndex", () => {
  const plain = Array<string | undefined>(8).fill(undefined);

  it("keeps the current block and the next one, folds the rest", () => {
    expect(upcomingFoldIndex(plain, 2, -1)).toBe(4);
  });

  it("no current block or too little left means no fold", () => {
    expect(upcomingFoldIndex(plain, -1, -1)).toBeNull();
    expect(upcomingFoldIndex(plain, 5, -1)).toBeNull(); // only block 7 would fold
  });

  it("never splits a superset run", () => {
    const labels = [undefined, "A", "A", "A", undefined, undefined, undefined];
    expect(upcomingFoldIndex(labels, 0, -1)).toBe(4);
  });

  it("never folds away a manually opened block", () => {
    expect(upcomingFoldIndex(plain, 0, 4)).toBe(5);
    expect(upcomingFoldIndex(plain, 0, 6)).toBeNull();
  });
});

describe("compactSet", () => {
  const base: SetLog = {
    id: "x",
    sessionId: "s",
    exerciseId: "squat",
    modalityId: "barbell",
    position: 1,
    setNumber: 1,
    unilateralMode: "bilateral",
    side: null,
    reps: 10,
    weightLbs: 135,
    addedWeightLbs: null,
    bandId: null,
    bandRole: null,
    durationSeconds: null,
    distanceFeet: null,
    rir: 2,
    isWarmup: false,
    completed: true,
    notes: "",
    conditioning: null,
  };
  const label = (patch: Partial<SetLog>) => compactSet({ ...base, ...patch });

  it("plates and dumbbells read weight as entered × reps", () => {
    expect(label({})).toBe("135×10");
    expect(label({ modalityId: "dumbbell", weightLbs: 50 })).toBe("50×10");
    expect(label({ rir: 0 })).toBe("135×10 F");
    expect(label({ unilateralMode: "single_side", weightLbs: 40 })).toBe("40×10/side");
  });

  it("bodyweight shows BW and any added load", () => {
    expect(label({ modalityId: "bodyweight", weightLbs: null })).toBe("BW×10");
    expect(label({ modalityId: "bodyweight", weightLbs: null, addedWeightLbs: 25, reps: 8 })).toBe(
      "BW+25×8",
    );
    expect(
      label({ modalityId: "bodyweight", weightLbs: null, reps: null, durationSeconds: 30 }),
    ).toBe("BW×30s");
  });

  it("bands read by color; hip bands never get pounds", () => {
    expect(
      label({ modalityId: "band", weightLbs: null, bandId: "band_blue", bandRole: "resistance", reps: 12 }),
    ).toBe("blue×12");
    expect(
      label({ modalityId: "band", weightLbs: null, bandId: "band_blue", bandRole: "assistance", reps: 6 }),
    ).toBe("−blue×6");
    const hip = label({
      modalityId: "band",
      exerciseId: "lateral_walk",
      weightLbs: null,
      bandId: "hip_band_medium",
      bandRole: "resistance",
      reps: 15,
    });
    expect(hip).toBe("medium band×15");
    expect(hip).not.toMatch(/lb|\d+×/);
  });

  it("verbose loadLabel adds units, keeps hip bands unit-free, null when unentered", () => {
    const verbose = (patch: Partial<SetLog>) => loadLabel({ ...base, ...patch }, { verbose: true });
    expect(verbose({})).toBe("135 lb");
    expect(verbose({ weightLbs: null })).toBeNull();
    expect(verbose({ modalityId: "bodyweight", weightLbs: null, addedWeightLbs: 45 })).toBe("BW+45 lb");
    expect(verbose({ modalityId: "band", bandId: "band_blue", bandRole: "assistance" })).toBe(
      "−blue band assist",
    );
    expect(verbose({ modalityId: "band", bandId: "hip_band_medium", bandRole: "resistance" })).toBe(
      "medium band",
    );
  });
});

describe("restAfterLog", () => {
  const rx = (exerciseId: string, restSeconds: number, supersetGroup: string | null = null) =>
    ({ exerciseId, modalityId: "barbell", restSeconds, supersetGroup }) as RoutineExercise;
  const v = (exerciseId: string) => ({ exerciseId, modalityId: "barbell" as const });
  const prescriptions = [rx("squat", 120, "A"), rx("row", 60, "A"), rx("curl", 45)];
  const groups = supersetGroups(prescriptions);

  it("no rest when handing off to the superset partner", () => {
    expect(restAfterLog(v("squat"), v("row"), prescriptions, groups)).toBeNull();
  });
  it("the prescription's rest when the round returns to the same exercise or leaves the pair", () => {
    expect(restAfterLog(v("squat"), v("squat"), prescriptions, groups)).toBe(120);
    expect(restAfterLog(v("row"), v("curl"), prescriptions, groups)).toBe(60);
    expect(restAfterLog(v("curl"), undefined, prescriptions, groups)).toBe(45);
  });
  it("the default rest for an exercise added mid-session", () => {
    expect(restAfterLog(v("lunge"), undefined, prescriptions, groups)).toBe(DEFAULT_REST_SECONDS);
  });
});

describe("bike warm-up prescription", () => {
  const finisher = {
    ...BIKE_WARMUP_RX,
    routineId: "r_echo",
    order: 1,
    restSeconds: 120,
    conditioning: { intervalScheme: "8x20/10", targetWatts: 200, targetRpm: null },
  } as RoutineExercise;
  const squat = { exerciseId: "squat", modalityId: "barbell", restSeconds: 150 } as RoutineExercise;
  const bike = (isWarmup: boolean) => ({ exerciseId: "echo_bike", modalityId: "cardio" as const, isWarmup });

  it("the warm-up gets its own rx even beside an Echo finisher row", () => {
    expect(prescriptionFor([finisher], bike(true))).toBe(BIKE_WARMUP_RX);
    expect(prescriptionFor([finisher], bike(false))).toBe(finisher);
  });

  it("a lift toggled to warm-up keeps its routine row", () => {
    expect(prescriptionFor([squat], { exerciseId: "squat", modalityId: "barbell", isWarmup: true })).toBe(squat);
    expect(
      blockPrescription([squat], {
        exerciseId: "squat",
        modalityId: "barbell",
        sets: [{ isWarmup: true } as SetLog, { isWarmup: false } as SetLog],
      }),
    ).toBe(squat);
  });

  it("rests 60 s after the warm-up and labels the person's own piece", () => {
    expect(restAfterLog(bike(true), undefined, [finisher], new Map())).toBe(60);
    const piece = (intervalScheme: string | null, durationSeconds: number) =>
      ({ conditioning: { ...EMPTY_TARGET, intervalScheme }, durationSeconds }) as SetLog;
    expect(warmupRxLabel(BIKE_WARMUP_RX, piece("8x20/10", 240))).toBe("8 × 20/10 · warm-up, RPE 5–6 · rest 60s");
    expect(warmupRxLabel(BIKE_WARMUP_RX, piece(null, 300))).toBe("5:00 steady · warm-up, RPE 5–6 · rest 60s");
  });

  const bikeBlock = (isWarmup: boolean) => ({
    exerciseId: "echo_bike",
    modalityId: "cardio" as const,
    sets: [
      {
        exerciseId: "echo_bike",
        modalityId: "cardio",
        isWarmup,
        durationSeconds: 240,
        conditioning: { ...EMPTY_TARGET, intervalScheme: "8x20/10" },
      } as SetLog,
    ],
  });

  it("a warm-up bike block takes the warm-up's rx; a finisher block keeps its row", () => {
    expect(blockPrescription([finisher], bikeBlock(true))).toBe(BIKE_WARMUP_RX);
    expect(blockPrescription([finisher], bikeBlock(false))).toBe(finisher);
    expect(blockPrescription([finisher], { ...bikeBlock(true), sets: [] })).toBe(finisher);
  });

  it("blockRxLine: the warm-up's line, a bike piece without its target, a lift's rx", () => {
    expect(blockRxLine(BIKE_WARMUP_RX, bikeBlock(true), true)).toBe("8 × 20/10 · warm-up, RPE 5–6 · rest 60s");
    expect(blockRxLine(finisher, bikeBlock(false), true)).toBe("8 × 20/10 · rest 120s");
    const row = { ...squat, sets: 3, repMin: 5, repMax: 5, durationSeconds: null, targetRir: 2, conditioning: null };
    expect(blockRxLine(row, { exerciseId: "squat", modalityId: "barbell", sets: [] }, false)).toBe(
      "3×5 @ RIR 2 · rest 150s",
    );
    expect(blockRxLine(undefined, bikeBlock(false), true)).toBeNull();
  });
});

describe("open-block helpers", () => {
  const hint = {
    sinceDate: "2026-10-20",
    days: 28,
    exposures: 3,
  };
  const block = (completed: boolean[]) => ({
    exerciseId: "deadlift",
    modalityId: "barbell" as const,
    sets: completed.map((c, i) => ({ id: `s${i}`, completed: c }) as SetLog),
  });

  it("blockStall: shown while sets remain, dropped once the block is done", () => {
    const stalls = { "deadlift|barbell": hint };
    expect(blockStall(block([true, false]), stalls)).toBe(hint);
    expect(blockStall(block([true, true]), stalls)).toBeUndefined();
    expect(blockStall(block([false]), {})).toBeUndefined();
  });

  it("supersetPosition: adjacent runs only, tagged where they start", () => {
    const labels = ["A", "A", undefined, "B", "A"];
    expect(labels.map((_, i) => supersetPosition(labels, i))).toEqual([
      { inSuperset: true, starts: true },
      { inSuperset: true, starts: false },
      { inSuperset: false, starts: false },
      { inSuperset: false, starts: false },
      { inSuperset: false, starts: false },
    ]);
  });
});

describe("stallChipLabel", () => {
  it("is a short chip with the detail spelled out for hover and screen readers", () => {
    expect(stallChipLabel({ sinceDate: "2026-10-20", days: 28, exposures: 3 })).toEqual({
      text: "stalled 4 wk",
      title: "No progress in 4 weeks (3 sessions)",
    });
    expect(stallChipLabel({ sinceDate: "2026-11-01", days: 6, exposures: 1 }).title).toBe(
      "No progress in 1 week (1 session)",
    );
  });
});

