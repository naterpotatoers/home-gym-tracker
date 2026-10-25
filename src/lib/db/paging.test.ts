import { describe, expect, it } from "vitest";
import { fetchAllPages } from "./paging";

function fakeTable(size: number) {
  const rows = Array.from({ length: size }, (_, i) => i);
  const calls: [number, number][] = [];
  const fetchPage = async (from: number, to: number) => {
    calls.push([from, to]);
    return rows.slice(from, to + 1);
  };
  return { rows, calls, fetchPage };
}

describe("fetchAllPages", () => {
  it("reads past the page cap", async () => {
    const table = fakeTable(2500);
    expect(await fetchAllPages(table.fetchPage, 1000)).toEqual(table.rows);
    expect(table.calls).toEqual([
      [0, 999],
      [1000, 1999],
      [2000, 2999],
    ]);
  });

  it("issues one extra empty read on an exact multiple", async () => {
    const table = fakeTable(2000);
    expect(await fetchAllPages(table.fetchPage, 1000)).toHaveLength(2000);
    expect(table.calls).toHaveLength(3);
  });

  it("handles an empty table", async () => {
    const table = fakeTable(0);
    expect(await fetchAllPages(table.fetchPage, 1000)).toEqual([]);
  });
});
