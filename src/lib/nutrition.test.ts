import { describe, expect, it } from "vitest";
import { seedSnapshot } from "./data/seed-snapshot";
import { buildGymData } from "./gym-data";
import {
  dayTotals,
  foodLogsFor,
  foodNameKey,
  fractionLabel,
  normalizeFoodName,
  recentFoods,
  scaledMacros,
  searchFoods,
} from "./nutrition";
import type { FoodLog } from "./types";

const data = seedSnapshot();

const log = (overrides: Partial<FoodLog>): FoodLog => ({
  id: "fl_x",
  clientId: "nate",
  date: "2026-08-01",
  foodId: "f_chicken_breast",
  plateFraction: 0.5,
  kcal: 400,
  proteinG: 75,
  carbsG: 0,
  fatG: 9,
  ...overrides,
});

describe("scaledMacros", () => {
  it("scales per-plate values linearly by fraction", () => {
    const food = data.foodById.get("f_chicken_breast")!;
    const half = scaledMacros(food, 0.5);
    expect(half.kcal).toBe(400);
    expect(half.proteinG).toBe(75);
    const full = scaledMacros(food, 1);
    expect(full.kcal).toBe(food.plateKcal);
  });
});

describe("food name normalization", () => {
  it("trims and collapses whitespace", () => {
    expect(normalizeFoodName("  chicken   breast ")).toBe("chicken breast");
  });

  it("compare key is case-insensitive", () => {
    expect(foodNameKey("Chicken Breast")).toBe(foodNameKey("  chicken  BREAST"));
  });
});

describe("searchFoods", () => {
  it("matches case-insensitively on substring, sorted by name", () => {
    const hits = searchFoods(data.foods, "CHICK");
    expect(hits.map((f) => f.id)).toContain("f_chicken_breast");
    const names = hits.map((f) => f.name);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
  });

  it("empty query returns the whole catalog", () => {
    expect(searchFoods(data.foods, "").length).toBe(data.foods.length);
  });
});

describe("day logs and totals", () => {
  const custom = buildGymData({
    ...data,
    foodLogs: [
      log({ id: "a", date: "2026-08-01", kcal: 400, proteinG: 75, carbsG: 0, fatG: 9 }),
      log({ id: "b", date: "2026-08-01", foodId: "f_white_rice", kcal: 450, proteinG: 9, carbsG: 97.5, fatG: 2 }),
      log({ id: "c", date: "2026-08-02", kcal: 800, proteinG: 150, carbsG: 0, fatG: 18 }),
      log({ id: "d", date: "2026-08-01", clientId: "lidia", kcal: 100, proteinG: 1, carbsG: 2, fatG: 3 }),
    ],
  });

  it("foodLogsFor filters by client and day", () => {
    expect(foodLogsFor(custom, "nate", "2026-08-01").map((l) => l.id)).toEqual(["a", "b"]);
  });

  it("dayTotals sums the logged snapshots", () => {
    const totals = dayTotals(foodLogsFor(custom, "nate", "2026-08-01"));
    expect(totals.kcal).toBe(850);
    expect(totals.proteinG).toBe(84);
    expect(totals.carbsG).toBe(97.5);
    expect(totals.fatG).toBe(11);
  });
});

describe("recentFoods", () => {
  const custom = buildGymData({
    ...data,
    foodLogs: [
      log({ id: "a", date: "2026-08-01", foodId: "f_chicken_breast", plateFraction: 0.5 }),
      log({ id: "b", date: "2026-08-02", foodId: "f_white_rice", plateFraction: 0.25 }),
      // Newer chicken log: its fraction should win, and chicken sorts first.
      log({ id: "c", date: "2026-08-03", foodId: "f_chicken_breast", plateFraction: 0.75 }),
      log({ id: "d", date: "2026-08-01", clientId: "lidia", foodId: "f_pizza", plateFraction: 1 }),
    ],
  });

  it("returns distinct foods, most recent first, with the last fraction", () => {
    const recents = recentFoods(custom, "nate");
    expect(recents.map((r) => r.food.id)).toEqual(["f_chicken_breast", "f_white_rice"]);
    expect(recents[0].lastFraction).toBe(0.75);
  });

  it("respects the limit", () => {
    expect(recentFoods(custom, "nate", 1).length).toBe(1);
  });
});

describe("fractionLabel", () => {
  it("names exact quarters and thirds", () => {
    expect(fractionLabel(0.25)).toBe("¼ plate");
    expect(fractionLabel(1 / 3)).toBe("⅓ plate");
    expect(fractionLabel(0.5)).toBe("½ plate");
    expect(fractionLabel(1)).toBe("full plate");
  });

  it("falls back to a percentage", () => {
    expect(fractionLabel(0.4)).toBe("40% plate");
  });
});
