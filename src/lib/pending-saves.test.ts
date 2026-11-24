import { describe, expect, it } from "vitest";
import {
  isMigrationError,
  parseSnapshot,
  sameList,
  serializeSnapshot,
  snapshotAge,
  snapshotKey,
  SNAPSHOT_MAX_AGE_MS,
} from "./pending-saves";
import type { SetLog } from "./types";

function set(id: string, overrides: Partial<SetLog> = {}): SetLog {
  return {
    id,
    sessionId: "s_1",
    exerciseId: "echo_bike",
    modalityId: "cardio",
    position: 1,
    setNumber: 1,
    unilateralMode: "bilateral",
    side: null,
    reps: null,
    weightLbs: null,
    addedWeightLbs: null,
    bandId: null,
    bandRole: null,
    durationSeconds: 240,
    distanceFeet: null,
    rir: null,
    isWarmup: true,
    completed: false,
    notes: "",
    conditioning: {
      intervalScheme: "8x20/10",
      targetWatts: 225,
      targetRpm: null,
      avgWatts: null,
      maxWatts: null,
      avgRpm: null,
      calories: null,
    },
    ...overrides,
  };
}

const NOW = 1_800_000_000_000;
const logged = set("w", {
  completed: true,
  distanceFeet: 7075,
  conditioning: { ...set("w").conditioning!, avgWatts: 224, maxWatts: 286, avgRpm: 58, calories: 38, effort: 6 },
});

describe("set-list snapshot", () => {
  it("round-trips a list with an unsaved bike readout and an added exercise", () => {
    const local = [logged, set("sq", { exerciseId: "squat", modalityId: "barbell", position: 2 })];
    const back = parseSnapshot(serializeSnapshot(local, NOW), "s_1", NOW);
    expect(back).toEqual(local);
    expect(sameList(back!, local)).toBe(true);
  });

  it("detects any difference: a field, the order, a missing or extra row", () => {
    const server = [set("w"), set("sq", { position: 2 })];
    expect(sameList([logged, server[1]], server)).toBe(false);
    expect(sameList([server[1], server[0]], server)).toBe(false);
    expect(sameList([server[0]], server)).toBe(false);
    expect(sameList([...server, set("x")], server)).toBe(false);
  });

  it("ignores what the database normalizes away (null ≡ absent, band weights)", () => {
    const stored = set("b", {
      exerciseId: "pull_up",
      modalityId: "band",
      bandId: "band_red",
      bandRole: "assistance",
      conditioning: null,
    });
    const local = { ...stored, weightLbs: 45 }; // the server nulls band weights
    expect(sameList([local], [stored])).toBe(true);
    const cleared = { ...logged, conditioning: { ...logged.conditioning!, effort: null } };
    const { effort: _e, ...noEffort } = logged.conditioning!;
    void _e;
    expect(sameList([cleared], [{ ...logged, conditioning: noEffort }])).toBe(true);
  });

  it("ignores key order and undefined fields", () => {
    const { conditioning, ...rest } = logged;
    expect(sameList([{ conditioning, ...rest }], [logged])).toBe(true);
    expect(sameList([{ ...logged, notes: undefined as unknown as string }], [{ ...logged, notes: undefined as unknown as string }])).toBe(true);
  });

  it("reads a corrupt, foreign, or stale snapshot as none", () => {
    expect(parseSnapshot(null, "s_1", NOW)).toBeNull();
    expect(parseSnapshot("{oops", "s_1", NOW)).toBeNull();
    expect(parseSnapshot(JSON.stringify({ at: NOW, sets: "no" }), "s_1", NOW)).toBeNull();
    expect(parseSnapshot(serializeSnapshot([{ ...logged, sessionId: "s_2" }], NOW), "s_1", NOW)).toBeNull();
    expect(parseSnapshot(serializeSnapshot([logged], NOW - SNAPSHOT_MAX_AGE_MS - 1), "s_1", NOW)).toBeNull();
  });

  it("an empty list is a real snapshot (everything removed)", () => {
    expect(parseSnapshot(serializeSnapshot([], NOW), "s_1", NOW)).toEqual([]);
  });

  it("reports its age for pruning, null when unreadable", () => {
    expect(snapshotAge(serializeSnapshot([logged], NOW))).toBe(NOW);
    expect(snapshotAge("{oops")).toBeNull();
    expect(snapshotKey("s_1")).toBe("workout-pending-s_1");
  });
});

describe("isMigrationError", () => {
  it("only errors that name a migration file", () => {
    expect(isMigrationError("Saving effort needs a database update — run supabase/migrations/2026-11-23-bike-effort.sql")).toBe(true);
    expect(isMigrationError("Supabase didn't answer within 10s — try again.")).toBe(false);
  });
});
