import { describe, expect, it } from "vitest";
import { seedSnapshot } from "./data/seed-snapshot";
import { isMuscleSpan, muscleSpanRange } from "./muscle-span";
import { resolvePeriod } from "./periods";

const data = seedSnapshot();
const client = data.clients[0].id;
const today = "2026-10-22"; // a Thursday

describe("muscleSpanRange", () => {
  it("week is the Monday–Sunday week containing today", () => {
    expect(muscleSpanRange(data, client, "week", today)).toEqual({
      from: "2026-10-19",
      to: "2026-10-25",
      label: "Week of 2026-10-19",
    });
  });

  it("program matches resolvePeriod's program span", () => {
    const period = resolvePeriod(data, client, { period: "program", date: today });
    const range = muscleSpanRange(data, client, "program", today);
    expect(range.from).toBe(period.from);
    expect(range.to).toBe(period.to);
    expect(range.label).toBe(period.label);
  });

  it("all time has no bounds", () => {
    const range = muscleSpanRange(data, client, "all", today);
    expect(range.from).toBeUndefined();
    expect(range.to).toBeUndefined();
  });
});

describe("isMuscleSpan", () => {
  it("accepts only the chip ids", () => {
    expect(isMuscleSpan("week")).toBe(true);
    expect(isMuscleSpan("program")).toBe(true);
    expect(isMuscleSpan("all")).toBe(true);
    expect(isMuscleSpan("day")).toBe(false);
    expect(isMuscleSpan("")).toBe(false);
  });
});
