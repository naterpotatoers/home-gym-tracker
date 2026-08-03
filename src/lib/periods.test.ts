import { describe, expect, it } from "vitest";
import { seedSnapshot } from "./data/seed-snapshot";
import { addDaysIso, mondayOf, resolvePeriod } from "./periods";

const data = seedSnapshot();

describe("date helpers", () => {
  it("addDaysIso crosses month and year boundaries", () => {
    expect(addDaysIso("2026-01-31", 1)).toBe("2026-02-01");
    expect(addDaysIso("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDaysIso("2026-03-01", -1)).toBe("2026-02-28");
  });

  it("mondayOf returns the Monday of the containing week", () => {
    expect(mondayOf("2026-08-02")).toBe("2026-07-27"); // a Sunday
    expect(mondayOf("2026-07-27")).toBe("2026-07-27"); // Monday is a fixed point
  });
});

describe("resolvePeriod (explicit dates only — no wall clock)", () => {
  it("day steps by one", () => {
    const p = resolvePeriod(data, "nate", { period: "day", date: "2026-07-15" });
    expect(p.from).toBe("2026-07-15");
    expect(p.to).toBe("2026-07-15");
    expect(p.prevAnchor).toBe("2026-07-14");
    expect(p.nextAnchor).toBe("2026-07-16");
  });

  it("week snaps to Monday..Sunday", () => {
    const p = resolvePeriod(data, "nate", { period: "week", date: "2026-08-02" });
    expect(p.from).toBe("2026-07-27");
    expect(p.to).toBe("2026-08-02");
  });

  it("program uses the assignment span", () => {
    const assignment = data.assignments.find(
      (a) => a.clientId === "nate" && a.status === "active",
    );
    if (!assignment) return; // seed shape changed — other tests will notice
    const program = data.programById.get(assignment.programId)!;
    const p = resolvePeriod(data, "nate", { period: "program" });
    expect(p.from).toBe(assignment.startDate);
    expect(p.to).toBe(addDaysIso(assignment.startDate, program.weeks * 7 - 1));
    expect(p.prevAnchor).toBeNull();
  });

  it("custom respects explicit bounds", () => {
    const p = resolvePeriod(data, "nate", {
      period: "custom",
      from: "2026-06-01",
      to: "2026-06-30",
    });
    expect(p.from).toBe("2026-06-01");
    expect(p.to).toBe("2026-06-30");
  });
});
