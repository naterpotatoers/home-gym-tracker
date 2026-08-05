import type { GymData } from "./gym-data";
import type { PeriodKind } from "./periods";
import { defaultClientId } from "./queries";

/** The heat-map page's URL state, parsed/defaulted once by the server page —
 *  the counterpart of progress-url.ts, so parse and serialize can't drift. */
export type HeatmapParams = {
  client: string;
  /** The roster's default — `client` serializes only when it differs. Never
   *  serialized itself. */
  defaultClient: string;
  mode: "logged" | "prescribed";
  period: PeriodKind;
  date?: string;
  from?: string;
  to?: string;
  program?: string;
  week?: string;
  compare?: string;
  bDate?: string;
  bFrom?: string;
  bTo?: string;
  bProgram?: string;
  bWeek?: string;
};

export const HEATMAP_DEFAULTS = {
  mode: "logged",
  period: "week",
} as const;

const PERIOD_KINDS: readonly PeriodKind[] = ["day", "week", "program", "custom"];

export function parseHeatmapParams(
  raw: Record<string, string | undefined>,
  data: GymData,
): HeatmapParams {
  const fallback = defaultClientId(data);
  return {
    client: raw.client && data.clientById.has(raw.client) ? raw.client : fallback,
    defaultClient: fallback,
    mode: raw.mode === "prescribed" ? "prescribed" : HEATMAP_DEFAULTS.mode,
    period: PERIOD_KINDS.includes(raw.period as PeriodKind)
      ? (raw.period as PeriodKind)
      : HEATMAP_DEFAULTS.period,
    date: raw.date,
    from: raw.from,
    to: raw.to,
    program: raw.program,
    week: raw.week,
    compare: raw.compare,
    bDate: raw.bDate,
    bFrom: raw.bFrom,
    bTo: raw.bTo,
    bProgram: raw.bProgram,
    bWeek: raw.bWeek,
  };
}

export function heatmapHref(params: Partial<HeatmapParams>): string {
  const qs = new URLSearchParams();
  if (params.client && params.client !== params.defaultClient) qs.set("client", params.client);
  if (params.mode && params.mode !== HEATMAP_DEFAULTS.mode) qs.set("mode", params.mode);
  if (params.period && params.period !== HEATMAP_DEFAULTS.period) qs.set("period", params.period);
  for (const key of [
    "date", "from", "to", "program", "week", "compare",
    "bDate", "bFrom", "bTo", "bProgram", "bWeek",
  ] as const) {
    const value = params[key];
    if (value) qs.set(key, value);
  }
  const s = qs.toString();
  return `/metrics/heatmap${s ? `?${s}` : ""}`;
}
