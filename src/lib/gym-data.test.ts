import { describe, expect, it } from "vitest";
import { seedSnapshot } from "./data/seed-snapshot";

const data = seedSnapshot();

describe("buildGymData indexes", () => {
  it("sessionById / clientById / routineById / programById cover their tables", () => {
    expect(data.sessionById.size).toBe(data.sessions.length);
    expect(data.clientById.size).toBe(data.clients.length);
    expect(data.routineById.size).toBe(data.routines.length);
    expect(data.programById.size).toBe(data.programs.length);
    for (const s of data.sessions) expect(data.sessionById.get(s.id)).toBe(s);
  });

  it("setsBySession groups every set, sorted by position", () => {
    const indexed = [...data.setsBySession.values()].reduce((n, list) => n + list.length, 0);
    expect(indexed).toBe(data.setLogs.length);
    for (const list of data.setsBySession.values()) {
      for (let i = 1; i < list.length; i++) {
        expect(list[i].position).toBeGreaterThan(list[i - 1].position);
      }
    }
  });

  it("exercisesByRoutine sorts prescriptions by order", () => {
    for (const list of data.exercisesByRoutine.values()) {
      for (let i = 1; i < list.length; i++) {
        expect(list[i].order).toBeGreaterThan(list[i - 1].order);
      }
    }
  });
});
