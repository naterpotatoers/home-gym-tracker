import { describe, expect, it } from "vitest";
import { progressHref, type ProgressParams } from "./progress-url";

const DEFAULTS: ProgressParams = {
  client: "nate",
  exercise: "",
  modality: "",
  repMin: 8,
  repMax: 12,
  weight: 100,
  sort: "group",
  filter: "all",
  mod: "",
  group: "",
};

describe("progressHref", () => {
  it("all defaults produce a bare URL", () => {
    expect(progressHref(DEFAULTS)).toBe("/metrics");
  });

  it("only non-defaults appear, and they round-trip", () => {
    const href = progressHref({
      ...DEFAULTS,
      client: "lidia",
      exercise: "bench_press",
      modality: "barbell",
      repMin: 5,
      sort: "status",
      group: "legs",
    });
    const qs = new URLSearchParams(href.split("?")[1]);
    expect(qs.get("client")).toBe("lidia");
    expect(qs.get("exercise")).toBe("bench_press");
    expect(qs.get("modality")).toBe("barbell");
    expect(qs.get("repMin")).toBe("5");
    expect(qs.get("repMax")).toBeNull(); // default omitted
    expect(qs.get("weight")).toBeNull();
    expect(qs.get("sort")).toBe("status");
    expect(qs.get("filter")).toBeNull();
    expect(qs.get("group")).toBe("legs");
  });
});
