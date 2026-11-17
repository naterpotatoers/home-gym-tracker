import { describe, expect, it } from "vitest";
import { dash, errorMessage, lbs, plural } from "./format";
import { normalizeName, nameKey, parseAliases } from "./names";
import { macroLabel } from "./nutrition";

describe("format", () => {
  it("plural", () => {
    expect(plural(1, "week")).toBe("1 week");
    expect(plural(0, "week")).toBe("0 weeks");
    expect(plural(3, "person", "people")).toBe("3 people");
  });
  it("lbs rounds and groups", () => {
    expect(lbs(12340.4)).toBe("12,340 lb");
  });
  it("dash covers null and undefined only", () => {
    expect(dash(null)).toBe("—");
    expect(dash(undefined)).toBe("—");
    expect(dash(0)).toBe("0");
    expect(dash(5, (v) => `${v} lb`)).toBe("5 lb");
  });
  it("errorMessage", () => {
    expect(errorMessage(new Error("boom"), "fallback")).toBe("boom");
    expect(errorMessage("nope", "fallback")).toBe("fallback");
  });
  it("macroLabel", () => {
    const m = { proteinG: 40.4, carbsG: 119.6, fatG: 18 };
    expect(macroLabel(m)).toBe("40P / 120C / 18F");
    expect(macroLabel(m, { compact: true })).toBe("40P/120C/18F");
  });
});

describe("names", () => {
  it("normalizeName trims and single-spaces; nameKey lowercases", () => {
    expect(normalizeName("  Bench   Press ")).toBe("Bench Press");
    expect(nameKey("  Bench   PRESS ")).toBe("bench press");
  });
  it("parseAliases cleans, drops blanks, de-dupes case-insensitively (first wins)", () => {
    expect(parseAliases(" OHP, overhead  press,, ohp ,Overhead Press")).toEqual([
      "OHP",
      "overhead press",
    ]);
    expect(parseAliases("")).toEqual([]);
  });
});
