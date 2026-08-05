import { describe, expect, it } from "vitest";
import { seedSnapshot } from "./data/seed-snapshot";
import { weighInHistory } from "./weigh-ins";

const data = seedSnapshot();

describe("weighInHistory", () => {
  it("returns one client's weigh-ins ascending by date", () => {
    const history = weighInHistory(data, "nate");
    expect(history.length).toBeGreaterThanOrEqual(3);
    expect(history.every((w) => w.clientId === "nate")).toBe(true);
    const dates = history.map((w) => w.date);
    expect(dates).toEqual([...dates].sort());
  });

  it("is empty for a client with no weigh-ins", () => {
    expect(weighInHistory(data, "nobody")).toEqual([]);
  });
});
