import type { GymData } from "./gym-data";
import { addDaysIso, DAY_LABELS, hmmss, isoDow, mmss, mondayOf, shortDayLabel } from "./periods";
import type { ClientId, Run, RunKind, RunSource } from "./types";

export const RUN_KIND_LABELS: Record<RunKind, string> = {
  easy: "Easy",
  long: "Long",
  workout: "Workout",
  race: "Race",
};

export const RUN_KINDS = Object.keys(RUN_KIND_LABELS) as RunKind[];

export const RUN_SOURCE_LABELS: Record<RunSource, string> = {
  manual: "Manual",
  strava: "Strava",
  garmin: "Garmin",
};

export function isRunKind(value: string): value is RunKind {
  return value in RUN_KIND_LABELS;
}

const METERS_PER_MILE = 1609.344;

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

/** The runs in the Monday-week starting `weekStart` — the one week filter. */
function inWeek(runs: readonly Run[], weekStart: string): Run[] {
  const weekEnd = addDaysIso(weekStart, 7);
  return runs.filter((r) => r.date >= weekStart && r.date < weekEnd);
}

const totalMiles = (runs: readonly Run[]) => runs.reduce((sum, r) => sum + r.distanceMiles, 0);

/** The Monday–Sunday week containing `todayIso`, newest run first. */
export function runWeek(data: GymData, clientId: ClientId, todayIso: string): RunWeek {
  const weekStart = mondayOf(todayIso);
  const runs = inWeek(runsFor(data, clientId), weekStart);
  return {
    weekStart,
    runs,
    miles: totalMiles(runs),
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
  const mine = runsFor(data, clientId);
  return Array.from({ length: weeks }, (_, i) => {
    const weekStart = addDaysIso(current, -7 * (weeks - 1 - i));
    return { weekStart, miles: totalMiles(inWeek(mine, weekStart)) };
  });
}

/** One run as display text — plain data for the client-side Running
 *  section (no GymData, no Maps across the boundary). */
export type RunView = {
  id: string;
  dayLabel: string;
  kind: RunKind;
  kindLabel: string;
  miles: string;
  time: string;
  pace: string;
  heartRate: number | null;
  name: string;
  source: RunSource;
};

export type RunnerSummary = {
  clientId: ClientId;
  weekRuns: number;
  weekMiles: string;
  /** Last 6 Monday-weeks, oldest first: { "Oct 6", 12.4 }. */
  weekly: { label: string; miles: number }[];
  /** This week's runs, or the latest few when this week has none. */
  recent: RunView[];
  /** The import sources syncing this person's runs (empty = manual only). */
  syncSources: RunSource[];
};

/** Everything the Running section shows for one person. */
export function runnerSummary(
  data: GymData,
  clientId: ClientId,
  todayIso: string,
  syncSources: RunSource[],
  recentLimit = 5,
): RunnerSummary {
  const week = runWeek(data, clientId, todayIso);
  const recent = week.runs.length > 0 ? week.runs : runsFor(data, clientId).slice(0, recentLimit);
  return {
    clientId,
    weekRuns: week.runs.length,
    weekMiles: milesLabel(week.miles),
    weekly: weeklyMiles(data, clientId, todayIso).map((w) => ({
      label: shortDayLabel(w.weekStart),
      miles: w.miles,
    })),
    recent: recent.map((r) => ({
      id: r.id,
      // This week's runs by weekday; older ones by date.
      dayLabel: week.runs.includes(r) ? DAY_LABELS[isoDow(r.date) - 1] : shortDayLabel(r.date),
      kind: r.kind,
      kindLabel: RUN_KIND_LABELS[r.kind],
      miles: milesLabel(r.distanceMiles),
      time: hmmss(r.durationSeconds),
      pace: paceLabel(r),
      heartRate: r.avgHeartRate,
      name: r.name,
      source: r.source,
    })),
    syncSources,
  };
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
  activityName?: string;
  /** "YYYY-MM-DD HH:mm:ss" — the athlete's local wall clock. */
  startTimeLocal: string;
  activityType?: { typeKey?: string };
  distance?: number; // meters
  duration?: number; // seconds
  movingDuration?: number; // seconds
  elevationGain?: number; // meters
  averageHR?: number;
};

/** A Garmin activity worth importing as a run: any running type (road,
 *  trail, treadmill, track — Garmin's typeKeys all contain "running") with
 *  the distance and time a run row requires. Field names are read
 *  defensively — the list endpoint's schema isn't published. */
export function isGarminRun(a: GarminActivity): boolean {
  return (
    !!a.activityType?.typeKey?.includes("running") &&
    (a.distance ?? 0) > 0 &&
    (a.movingDuration ?? a.duration ?? 0) > 0 &&
    typeof a.startTimeLocal === "string"
  );
}

/** Garmin activity → Run fields. Garmin has no run-type tag, so imports are
 *  "easy" until re-tagged. */
export function runFromGarmin(a: GarminActivity, clientId: ClientId): Omit<Run, "id"> {
  return {
    clientId,
    date: a.startTimeLocal.slice(0, 10),
    distanceMiles: Math.round(((a.distance ?? 0) / METERS_PER_MILE) * 100) / 100,
    durationSeconds: Math.round(a.movingDuration ?? a.duration ?? 0),
    kind: "easy",
    avgHeartRate: a.averageHR ? Math.round(a.averageHR) : null,
    elevationGainFt: a.elevationGain !== undefined ? Math.round(a.elevationGain * 3.28084) : null,
    name: a.activityName ?? "",
    source: "garmin",
    externalId: `garmin:${a.activityId}`,
    notes: "",
  };
}

/** The same physical run seen through two sources (a Garmin watch that also
 *  pushes to Strava): same day, distance within 2% (or 0.05 mi), moving time
 *  within 90 s. */
export function isSameRun(
  a: Pick<Run, "date" | "distanceMiles" | "durationSeconds">,
  b: Pick<Run, "date" | "distanceMiles" | "durationSeconds">,
): boolean {
  const milesTolerance = Math.max(0.05, 0.02 * Math.max(a.distanceMiles, b.distanceMiles));
  return (
    a.date === b.date &&
    Math.abs(a.distanceMiles - b.distanceMiles) <= milesTolerance &&
    Math.abs(a.durationSeconds - b.durationSeconds) <= 90
  );
}

export type RunSyncPlan = {
  /** Never seen: insert. */
  fresh: Omit<Run, "id">[];
  /** Already imported from this source: refresh, keyed by existing row id. */
  known: { id: string; run: Omit<Run, "id"> }[];
  /** Already logged from another source (or by hand) — skipped. */
  duplicates: number;
};

/**
 * Split a sync batch: rows already imported (by external id) refresh; rows
 * matching a run from any OTHER source are skipped so one run never counts
 * twice; the rest are new.
 */
export function planRunSync(
  incoming: readonly Omit<Run, "id">[],
  idByExternal: ReadonlyMap<string, string>,
  others: readonly Pick<Run, "date" | "distanceMiles" | "durationSeconds" | "source">[],
): RunSyncPlan {
  const plan: RunSyncPlan = { fresh: [], known: [], duplicates: 0 };
  for (const run of incoming) {
    const id = run.externalId ? idByExternal.get(run.externalId) : undefined;
    if (id) plan.known.push({ id, run });
    else if (others.some((o) => o.source !== run.source && isSameRun(o, run))) plan.duplicates++;
    else plan.fresh.push(run);
  }
  return plan;
}

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
