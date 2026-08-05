import { describe, expect, it } from "vitest";
import { seedSnapshot } from "./data/seed-snapshot";
import { heatmapHref, parseHeatmapParams, type HeatmapParams } from "./heatmap-url";

const data = seedSnapshot();
const first = data.clients[0].id;

describe("parseHeatmapParams", () => {
  it("empty params give roster-default client, logged mode, week period", () => {
    const params = parseHeatmapParams({}, data);
    expect(params.client).toBe(first);
    expect(params.defaultClient).toBe(first);
    expect(params.mode).toBe("logged");
    expect(params.period).toBe("week");
  });

  it("rejects unknown clients, modes, and periods", () => {
    const params = parseHeatmapParams(
      { client: "bogus", mode: "wat", period: "fortnight" },
      data,
    );
    expect(params.client).toBe(first);
    expect(params.mode).toBe("logged");
    expect(params.period).toBe("week");
  });
});

describe("heatmapHref", () => {
  it("all defaults produce a bare URL", () => {
    expect(heatmapHref(parseHeatmapParams({}, data))).toBe("/metrics/heatmap");
  });

  it("round-trips: parse(serialize(params)) === params", () => {
    const params: HeatmapParams = {
      ...parseHeatmapParams({}, data),
      client: "nate",
      mode: "prescribed",
      period: "program",
      program: "p_foundations",
      week: "3",
      compare: "1",
      bProgram: "p_upper_lower",
      bWeek: "2",
    };
    const qs = new URLSearchParams(heatmapHref(params).split("?")[1] ?? "");
    const reparsed = parseHeatmapParams(Object.fromEntries(qs.entries()), data);
    expect(reparsed).toEqual(params);
  });
});
