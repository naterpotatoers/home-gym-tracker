import { pieceSeconds } from "./conditioning";
import { sidesWorked } from "./modality";
import type { RoutineExercise } from "./types";

/** Seconds per rep for the estimate — controlled tempo, no grinding. */
const SECONDS_PER_REP = 3;
/** Walking to the next station, grabbing the band. */
const TRANSITION_SECONDS = 15;

type TimedRow = Pick<
  RoutineExercise,
  | "sets"
  | "repMin"
  | "repMax"
  | "durationSeconds"
  | "restSeconds"
  | "unilateralMode"
  | "supersetGroup"
  | "conditioning"
>;

/** One set's working time: the timed seconds (or the bike piece), else reps
 *  at a steady tempo — doubled when each side is done separately. */
function workSeconds(row: TimedRow): number {
  const base =
    row.durationSeconds !== null || row.conditioning !== null
      ? pieceSeconds(row)
      : (row.repMax ?? row.repMin ?? 10) * SECONDS_PER_REP;
  return base * sidesWorked(row);
}

/**
 * Rough minutes to run a routine's rows in order: every set's work plus its
 * rest, a short transition per exercise. Inside a superset the runner skips
 * the rest between members (restAfterLog), so only the group's last row
 * rests — a superset costs rounds × (members' work + one rest). A planning
 * number for "is this a 10-minute finisher?", not a promise.
 */
export function estimatedSeconds(rows: readonly TimedRow[]): number {
  let total = 0;
  rows.forEach((row, i) => {
    const next = rows[i + 1];
    const restsHere = !(row.supersetGroup && next?.supersetGroup === row.supersetGroup);
    total += row.sets * (workSeconds(row) + (restsHere ? row.restSeconds : 0));
    total += TRANSITION_SECONDS;
  });
  return total;
}

/** estimatedSeconds rounded to whole minutes (never below 1). */
export function estimatedMinutes(rows: readonly TimedRow[]): number {
  return Math.max(1, Math.round(estimatedSeconds(rows) / 60));
}
