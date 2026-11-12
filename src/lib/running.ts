import type { GymData } from "./gym-data";
import { addDaysIso, mmss, mondayOf } from "./periods";
import type { ClientId, Run, RunKind } from "./types";

export const RUN_KIND_LABELS: Record<RunKind, string> = {
  easy: "Easy",
  long: "Long",
  workout: "Workout",
  race: "Race",
};

export const METERS_PER_MILE = 1609.344;

/** Seconds per mile, or null for a run with no distance. */
export function paceSecondsPerMile(run: Pick<Run, "distanceMiles" | "durationSeconds">): number | null {
  return run.distanceMiles > 0 ? run.durationSeconds / run.distanceMiles : null;
}

/** "9:20 /mi" */
export function paceLabel(run: Pick<Run, "distanceMiles" | "durationSeconds">): string {
  const pace = paceSecondsPerMile(run);
  return pace === null ? "—" : `${mmss(Math.round(pace))} /mi`;
}

/** "7.0 mi" — one decimal reads like a watch face. */
export function milesLabel(miles: number): string {
  return `${miles.toFixed(1)} mi`;
}

export function runsFor(data: GymData, clientId: ClientId): Run[] {
  return data.runs
    .filter((r) => r.clientId === clientId)
    .sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
}

export type RunWeek = {
  /** Monday of the week (the schema's week start). */
  weekStart: string;
  runs: Run[];
  miles: number;
  seconds: number;
};

/** The Monday–Sunday week containing `todayIso`, newest run first. */
export function runWeek(data: GymData, clientId: ClientId, todayIso: string): RunWeek {
  const weekStart = mondayOf(todayIso);
  const weekEnd = addDaysIso(weekStart, 7);
  const runs = runsFor(data, clientId).filter((r) => r.date >= weekStart && r.date < weekEnd);
  return {
    weekStart,
    runs,
    miles: runs.reduce((sum, r) => sum + r.distanceMiles, 0),
    seconds: runs.reduce((sum, r) => sum + r.durationSeconds, 0),
  };
}

/** Weekly mileage for the `weeks` weeks ending with the current one, oldest
 *  first — for "am I ramping too fast" at a glance. */
export function weeklyMiles(
  data: GymData,
  clientId: ClientId,
  todayIso: string,
  weeks = 6,
): { weekStart: string; miles: number }[] {
  const current = mondayOf(todayIso);
  return Array.from({ length: weeks }, (_, i) => {
    const weekStart = addDaysIso(current, -7 * (weeks - 1 - i));
    const weekEnd = addDaysIso(weekStart, 7);
    const miles = data.runs
      .filter((r) => r.clientId === clientId && r.date >= weekStart && r.date < weekEnd)
      .reduce((sum, r) => sum + r.distanceMiles, 0);
    return { weekStart, miles };
  });
}

/** Strava's workout_type for runs: 1 race, 2 long run, 3 workout; else easy. */
export function kindFromStrava(workoutType: number | null | undefined): RunKind {
  return workoutType === 1 ? "race" : workoutType === 2 ? "long" : workoutType === 3 ? "workout" : "easy";
}

/** The subset of Strava's SummaryActivity this app reads. */
export type StravaActivity = {
  id: number;
  name: string;
  sport_type: string;
  distance: number; // meters
  moving_time: number; // seconds
  total_elevation_gain: number; // meters
  /** Local wall-clock start, formatted with a misleading "Z" — the date part
   *  is already the athlete's local day. */
  start_date_local: string;
  average_heartrate?: number;
  workout_type?: number | null;
};

/** The subset of a Garmin Connect activity-list item this app reads. */
export type GarminActivity = {
  activityId: number;
  activityName: string;
  /** "YYYY-MM-DD HH:mm:ss" — the athlete's local wall clock. */
  startTimeLocal: string;
  activityType: { typeKey: string };
  distance?: number; // meters
  duration?: number; // seconds
  movingDuration?: number; // seconds
  elevationGain?: number; // meters
  averageHR?: number;
};

/** Strava activity → Run fields (everything but the row id). */
export function runFromActivity(a: StravaActivity, clientId: ClientId): Omit<Run, "id"> {
  return {
    clientId,
    date: a.start_date_local.slice(0, 10),
    distanceMiles: Math.round((a.distance / METERS_PER_MILE) * 100) / 100,
    durationSeconds: a.moving_time,
    kind: kindFromStrava(a.workout_type),
    avgHeartRate: a.average_heartrate ? Math.round(a.average_heartrate) : null,
    elevationGainFt: Math.round(a.total_elevation_gain * 3.28084),
    name: a.name,
    source: "strava",
    externalId: `strava:${a.id}`,
    notes: "",
  };
}
