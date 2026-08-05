import { describe, expect, it } from "vitest";
import { seedSnapshot } from "./data/seed-snapshot";
import { parseProgressParams, progressHref, type ProgressParams } from "./progress-url";

const data = seedSnapshot();
const first = data.clients[0].id;

const DEFAULTS: ProgressParams = {
  client: first,
  defaultClient: first,
  view: "metrics",
  exercise: "",
  modality: "",
  repMin: 8,
  repMax: 12,
  weight: 100,
  mod: "",
  group: "",
};

describe("progressHref", () => {
  it("all defaults produce a bare URL", () => {
    expect(progressHref(DEFAULTS)).toBe("/users");
  });

  it("non-default views serialize; default view is omitted", () => {
    expect(progressHref({ ...DEFAULTS, view: "tracking" })).toBe("/users?view=tracking");
    expect(progressHref({ ...DEFAULTS, view: "profile" })).toBe("/users?view=profile");
    expect(progressHref({ ...DEFAULTS, view: "add" })).toBe("/users?view=add");
    expect(progressHref({ ...DEFAULTS, view: "metrics" })).toBe("/users");
  });

  it("only non-defaults appear, and they round-trip", () => {
    const href = progressHref({
      ...DEFAULTS,
      client: "nate",
      exercise: "bench_press",
      modality: "barbell",
      repMin: 5,
      group: "legs",
    });
    const qs = new URLSearchParams(href.split("?")[1]);
    expect(qs.get("client")).toBe("nate");
    expect(qs.get("exercise")).toBe("bench_press");
    expect(qs.get("modality")).toBe("barbell");
    expect(qs.get("repMin")).toBe("5");
    expect(qs.get("repMax")).toBeNull(); // default omitted
    expect(qs.get("weight")).toBeNull();
    expect(qs.get("group")).toBe("legs");
    expect(qs.get("defaultClient")).toBeNull(); // never serialized
  });
});

describe("parseProgressParams", () => {
  it("empty params give the roster default, not a hardcoded id", () => {
    const params = parseProgressParams({}, data);
    expect(params.client).toBe(first);
    expect(params.defaultClient).toBe(first);
    expect(params.view).toBe("metrics");
    expect(params.repMin).toBe(8);
  });

  it("unknown client falls back instead of crashing", () => {
    expect(parseProgressParams({ client: "bogus" }, data).client).toBe(first);
  });

  it("round-trips: parse(serialize(params)) === params", () => {
    const params: ProgressParams = {
      ...DEFAULTS,
      client: "lidia",
      view: "tracking",
      exercise: "squat",
      modality: "barbell",
      repMin: 5,
      weight: 135,
      mod: "barbell",
      group: "legs",
    };
    const qs = new URLSearchParams(progressHref(params).split("?")[1] ?? "");
    const raw = Object.fromEntries(qs.entries());
    expect(parseProgressParams(raw, data)).toEqual(params);
  });

  it("rejects invalid exercise/modality pairs and bad numbers", () => {
    const params = parseProgressParams(
      { exercise: "not_a_lift", modality: "barbell", repMin: "-3", weight: "abc" },
      data,
    );
    expect(params.exercise).toBe("");
    expect(params.modality).toBe("");
    expect(params.repMin).toBe(8);
    expect(params.weight).toBe(100);
  });

  it("unknown views (including retired 'settings') fall back to metrics", () => {
    expect(parseProgressParams({ view: "bogus" }, data).view).toBe("metrics");
    expect(parseProgressParams({ view: "settings" }, data).view).toBe("metrics");
    expect(parseProgressParams({ view: "profile" }, data).view).toBe("profile");
    expect(parseProgressParams({ view: "add" }, data).view).toBe("add");
  });
});
