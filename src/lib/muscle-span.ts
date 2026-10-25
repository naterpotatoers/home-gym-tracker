import type { GymData } from "./gym-data";
import { resolvePeriod } from "./periods";
import type { ClientId } from "./types";

/** The Progress tab's body-map range chips. "all" = no date bounds. */
export const MUSCLE_SPANS = [
  { id: "week", label: "Week" },
  { id: "program", label: "Program" },
  { id: "all", label: "All time" },
] as const;

export type MuscleSpan = (typeof MUSCLE_SPANS)[number]["id"];

export function isMuscleSpan(value: string): value is MuscleSpan {
  return MUSCLE_SPANS.some((s) => s.id === value);
}

/** A span chip → the muscleVolume range plus a human label. Week and program
 *  delegate to resolvePeriod (anchored on `today`), so the chips can't drift
 *  from the date module's week/program rules. */
export function muscleSpanRange(
  data: GymData,
  clientId: ClientId,
  span: MuscleSpan,
  today: string,
): { from?: string; to?: string; label: string } {
  if (span === "all") return { label: "All time" };
  const period = resolvePeriod(data, clientId, { period: span, date: today });
  return { from: period.from, to: period.to, label: period.label };
}
