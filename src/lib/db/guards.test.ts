import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("./client", () => ({ supabase: {} }));
const { isMissingColumn, isMissingTable } = await import("./guards");

describe("un-migrated DB checks", () => {
  it("a missing table is PostgREST's PGRST205 only", () => {
    expect(isMissingTable({ code: "PGRST205" })).toBe(true);
    expect(isMissingTable({ code: "PGRST204" })).toBe(false);
    expect(isMissingTable(null)).toBe(false);
  });

  it("a missing column on a write (PGRST204) or a select (42703)", () => {
    expect(isMissingColumn({ code: "PGRST204" })).toBe(true);
    expect(isMissingColumn({ code: "42703" })).toBe(true);
    expect(isMissingColumn({ code: "23505" })).toBe(false);
    expect(isMissingColumn(undefined)).toBe(false);
  });
});
