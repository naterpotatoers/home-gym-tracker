import { describe, expect, it } from "vitest";
import { seedSnapshot } from "./data/seed-snapshot";
import { sessionTopLifts } from "./progress";
import { clientSummaries, hipBandLadder, latestSet, sessionsFor } from "./queries";
import { bandLabel, completedCount, schemeLabel } from "./session-labels";
import type { RoutineExercise } from "./types";

const data = seedSnapshot();

describe("people queries", () => {
  it("sessionsFor: only that person, newest first", () => {
    const client = data.clients[0].id;
    const mine = sessionsFor(data, client);
    expect(mine.every((s) => s.clientId === client)).toBe(true);
    expect(mine.map((s) => s.date)).toEqual([...mine.map((s) => s.date)].sort().reverse());
  });

  it("clientSummaries counts completed sessions and the last date", () => {
    const asOf = new Date("2026-11-16T12:00:00Z");
    for (const summary of clientSummaries(data, asOf)) {
      const done = data.sessions.filter(
        (s) => s.clientId === summary.client.id && s.status === "completed",
      );
      expect(summary.sessionCount).toBe(done.length);
      expect(summary.lastSessionDate).toBe(done.map((s) => s.date).sort().at(-1) ?? null);
      expect(summary.age).toBeGreaterThan(0);
    }
  });

  it("latestSet picks the set from the newest session", () => {
    const sets = data.setLogs.slice(0, 200);
    const latest = latestSet(data, sets)!;
    const newest = Math.max(...sets.map((s) => Date.parse(data.sessionById.get(s.sessionId)!.date)));
    expect(Date.parse(data.sessionById.get(latest.sessionId)!.date)).toBe(newest);
    expect(latestSet(data, [])).toBeNull();
  });

  it("hipBandLadder ranks easiest → hardest without gaps", () => {
    const ladder = hipBandLadder();
    expect(ladder.length).toBeGreaterThan(0);
    const ranks = ladder.map((b) => b.rank);
    expect(ranks).toEqual([...ranks].sort((a, b) => a - b));
    expect(new Set(ranks).size).toBe(ranks.length);
  });
});

describe("sessionTopLifts", () => {
  it("returns at most `limit` lifts, best e1RM first", () => {
    for (const session of data.sessions.filter((s) => s.status === "completed").slice(0, 20)) {
      const tops = sessionTopLifts(data, session.id, 3);
      expect(tops.length).toBeLessThanOrEqual(3);
      const e1rms = tops.map((t) => t.bestE1rmLbs);
      expect(e1rms).toEqual([...e1rms].sort((a, b) => b - a));
      // Every listed lift has a real e1RM (ordinal band work has none).
      for (const t of tops) expect(t.bestE1rmLbs).toBeGreaterThan(0);
    }
  });
});

describe("small labels", () => {
  it("completedCount", () => {
    const sets = data.setLogs.slice(0, 10);
    expect(completedCount(sets)).toBe(sets.filter((s) => s.completed).length);
    expect(completedCount([])).toBe(0);
  });

  it("bandLabel strips the id prefix", () => {
    expect(bandLabel({ bandId: "band_blue" })).toBe("blue");
    expect(bandLabel({ bandId: "hip_band_small" })).toBe("small");
    expect(bandLabel({ bandId: null })).toBe("");
  });

  it("schemeLabel: time, range, fixed, unknown", () => {
    const rx = (over: Partial<RoutineExercise>) =>
      ({ sets: 3, repMin: 8, repMax: 10, durationSeconds: null, ...over }) as RoutineExercise;
    expect(schemeLabel(rx({ durationSeconds: 30 }))).toBe("3×30s");
    expect(schemeLabel(rx({}))).toBe("3×8–10");
    expect(schemeLabel(rx({ repMin: 5, repMax: 5 }))).toBe("3×5");
    expect(schemeLabel(rx({ repMin: null, repMax: null }))).toBe("3×?");
  });
});
