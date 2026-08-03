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
  /** Extra annotation for ordinal work, e.g. "+120 ord". */
  ordinalNote?: string;
};

export type MeterGroup = { groupId: string; label: string; rows: MeterRow[] };
