import { describe, expect, it } from "vitest";
import { serializeSnapshot, SNAPSHOT_MAX_AGE_MS } from "./pending-saves";
import { CLOCK_STALE_MS, inheritedStart, staleKeys } from "./session-clock";

const NOW = 1_800_000_000_000;

describe("inheritedStart", () => {
  it("a solo runner takes the board's start for the same person", () => {
    const entries = [
      ["workout-start-s_a,s_b,s_c", String(NOW - 95 * 60_000)],
      ["theme", "dark"],
    ] as const;
    expect(inheritedStart(entries, "s_b", NOW)).toBe(NOW - 95 * 60_000);
  });

  it("ignores other sessions, solo keys, stale and junk values", () => {
    const entries = [
      ["workout-start-s_x,s_y", String(NOW - 1000)],
      ["workout-start-s_b", String(NOW - 1000)],
      ["workout-start-s_b,s_c", String(NOW - CLOCK_STALE_MS - 1)],
      ["workout-start-s_b,s_d", "nope"],
    ] as const;
    expect(inheritedStart(entries, "s_b", NOW)).toBeNull();
  });

  it("the earliest of two boards wins", () => {
    const entries = [
      ["workout-start-s_a,s_b", String(NOW - 10_000)],
      ["workout-start-s_b,s_c", String(NOW - 50_000)],
    ] as const;
    expect(inheritedStart(entries, "s_b", NOW)).toBe(NOW - 50_000);
  });
});

describe("staleKeys", () => {
  it("prunes old clocks and snapshots, keeps live ones and unrelated keys", () => {
    const entries = [
      ["workout-start-s_live", String(NOW - 60_000)],
      ["workout-start-s_old", String(NOW - CLOCK_STALE_MS - 1)],
      ["workout-start-s_junk", "nope"],
      ["workout-pending-s_live", serializeSnapshot([], NOW - 60_000)],
      ["workout-pending-s_old", serializeSnapshot([], NOW - SNAPSHOT_MAX_AGE_MS - 1)],
      ["workout-pending-s_junk", "{oops"],
      ["theme", "dark"],
    ] as const;
    expect(staleKeys(entries, NOW).sort()).toEqual([
      "workout-pending-s_junk",
      "workout-pending-s_old",
      "workout-start-s_junk",
      "workout-start-s_old",
    ]);
  });
});
