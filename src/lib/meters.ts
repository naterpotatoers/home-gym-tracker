import type { CoverageStatus } from "./coverage";

/** View-model rows for the status-colored muscle meters. Lives in lib so the
 *  domain layer (progress.ts) never depends on a component module. */
export type MeterRow = {
  id: string;
  name: string;
  peakScore: number;
  /** Drives bar length, relative to the group set's max. */
  value: number;
  /** Right-hand value text — "4.5" hard sets or "12,340 lb". */
  display: string;
  status: CoverageStatus;
};

export type MeterGroup = { groupId: string; label: string; rows: MeterRow[] };

/** One point on a progress/weight chart. `sessionId` is the React key slot —
 *  weigh-in points put their weigh-in id there. */
export type ChartPoint = {
  date: string;
  y: number;
  sessionId: string;
  /** Pinned-row line, e.g. "2026-06-15 · 185 lb × 5 · e1RM 216 lb". */
  detail: string;
};

/** Dashed projection segment — fitted value at the window end, extrapolated
 *  +8 weeks. */
export type TrendSegment = {
  fromDate: string;
  fromY: number;
  toDate: string;
  toY: number;
};
