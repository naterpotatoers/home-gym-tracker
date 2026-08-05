import type { MeterGroup } from "./meters";
import { volumeStatus } from "./coverage";
import { scoresByExercise } from "./data/exercises";
import { muscleById } from "./data/muscles";
import type { GymData } from "./gym-data";
import { bestE1rm, e1rm, setLoad } from "./modality";
import { addDaysIso, utcDay } from "./periods";
import { blocksFor, muscleVolumeByGroup, workingSets } from "./queries";
import type { ClientId, ExerciseId, ModalityId, MuscleGroupId } from "./types";

/**
 * Time-series and frequency stats for the Progress page. Pure and synchronous
 * over `GymData`, like coverage.ts. The chart's y-axis is RAW e1RM with the
 * modality pinned — `normalizedLoad`'s seed↔measured factor switching would
 * silently reshape a progress line between visits. Ordinal (hip-band) work
 * never produces a number here: sessions of it yield `bestE1rmLbs: null`.
 */

export type ExerciseHistoryPoint = {
  sessionId: string;
  date: string;
  /** Null when the session's sets were all ordinal/unloaded. */
  bestE1rmLbs: number | null;
  /** Heaviest loaded working set — TOTAL lbs moved per rep, and its reps. */
  topSet: { weightLbs: number; reps: number } | null;
  setCount: number;
  /** Σ load × total reps over loaded sets. */
  volumeLbs: number;
};

/** Per-completed-session bests for one client × variant, ascending by date —
 *  chart order; history tables reverse it. */
export function exerciseHistory(
  data: GymData,
  clientId: ClientId,
  exerciseId: ExerciseId,
  modalityId: ModalityId,
): ExerciseHistoryPoint[] {
  const bySession = new Map<string, typeof sets>();
  const sets = workingSets(data, clientId, exerciseId, modalityId);
  for (const set of sets) {
    const session = data.sessionById.get(set.sessionId);
    if (!session || session.status !== "completed") continue;
    const existing = bySession.get(set.sessionId);
    if (existing) existing.push(set);
    else bySession.set(set.sessionId, [set]);
  }

  const points: ExerciseHistoryPoint[] = [];
  for (const [sessionId, sessionSets] of bySession) {
    const date = data.sessionById.get(sessionId)!.date;
    let top: { weightLbs: number; reps: number } | null = null;
    let volumeLbs = 0;
    for (const set of sessionSets) {
      const load = setLoad(data, set);
      if (load.lbs === null) continue;
      volumeLbs += load.lbs * load.totalReps;
      if (top === null || load.lbs > top.weightLbs) {
        top = { weightLbs: load.lbs, reps: set.reps ?? 0 };
      }
    }
    points.push({
      sessionId,
      date,
      bestE1rmLbs: bestE1rm(data, sessionSets),
      topSet: top,
      setCount: sessionSets.length,
      volumeLbs,
    });
  }
  return points.sort(
    (a, b) => a.date.localeCompare(b.date) || a.sessionId.localeCompare(b.sessionId),
  );
}

export type LiftFrequency = {
  exerciseId: ExerciseId;
  modalityId: ModalityId;
  sessionCount: number;
  lastDate: string;
  bestE1rmLbs: number | null;
};

/** How often each variant shows up in completed sessions, most-trained first.
 *  Ordinal lifts stay in — frequency is meaningful even when pounds aren't. */
export function liftFrequency(data: GymData, clientId: ClientId): LiftFrequency[] {
  const byVariant = new Map<
    string,
    { exerciseId: ExerciseId; modalityId: ModalityId; sessions: Set<string>; lastDate: string; best: number | null }
  >();
  for (const set of workingSets(data, clientId)) {
    const session = data.sessionById.get(set.sessionId);
    if (!session || session.status !== "completed") continue;
    const key = `${set.exerciseId}|${set.modalityId}`;
    let entry = byVariant.get(key);
    if (!entry) {
      entry = {
        exerciseId: set.exerciseId,
        modalityId: set.modalityId,
        sessions: new Set(),
        lastDate: session.date,
        best: null,
      };
      byVariant.set(key, entry);
    }
    entry.sessions.add(set.sessionId);
    if (session.date > entry.lastDate) entry.lastDate = session.date;
    const value = e1rm(data, set);
    if (value !== null && (entry.best === null || value > entry.best)) {
      entry.best = value;
    }
  }
  return [...byVariant.values()]
    .map((e) => ({
      exerciseId: e.exerciseId,
      modalityId: e.modalityId,
      sessionCount: e.sessions.size,
      lastDate: e.lastDate,
      bestE1rmLbs: e.best,
    }))
    .sort(
      (a, b) => b.sessionCount - a.sessionCount || b.lastDate.localeCompare(a.lastDate),
    );
}

export type E1rmTrend = {
  slopePerWeek: number;
  /** Fitted value on the last session date — the projection's anchor. */
  fittedLastLbs: number;
  /** Anchored at the fitted value on the last session date, clamped ≥ 0 —
   *  a declining projection is honest information. */
  projected4wkLbs: number;
  projected8wkLbs: number;
  r2: number;
  pointCount: number;
  windowFrom: string;
  windowTo: string;
};

/**
 * Least-squares fit of e1RM over the trailing window. Null (tiles show "—")
 * when the data can't honestly support a line: fewer than 3 loaded sessions
 * in the window, all on one day, or spread across less than two weeks —
 * three sessions inside one week extrapolated two months out is noise.
 */
export function e1rmTrend(
  history: readonly ExerciseHistoryPoint[],
  opts: { days?: number } = {},
): E1rmTrend | null {
  const days = opts.days ?? 90;
  const loaded = history.filter((p) => p.bestE1rmLbs !== null);
  if (loaded.length === 0) return null;
  const last = loaded[loaded.length - 1];
  const cutoff = utcDay(last.date) - days;
  const window = loaded.filter((p) => utcDay(p.date) >= cutoff);
  if (window.length < 3) return null;

  const x0 = utcDay(window[0].date);
  const xs = window.map((p) => utcDay(p.date) - x0);
  const ys = window.map((p) => p.bestE1rmLbs!);
  const spread = xs[xs.length - 1] - xs[0];
  if (spread < 14) return null;

  const n = xs.length;
  const xMean = xs.reduce((a, b) => a + b, 0) / n;
  const yMean = ys.reduce((a, b) => a + b, 0) / n;
  let sxy = 0;
  let sxx = 0;
  for (let i = 0; i < n; i++) {
    sxy += (xs[i] - xMean) * (ys[i] - yMean);
    sxx += (xs[i] - xMean) ** 2;
  }
  if (sxx === 0) return null;
  const slope = sxy / sxx;
  const intercept = yMean - slope * xMean;

  let ssRes = 0;
  let ssTot = 0;
  for (let i = 0; i < n; i++) {
    ssRes += (ys[i] - (intercept + slope * xs[i])) ** 2;
    ssTot += (ys[i] - yMean) ** 2;
  }
  const r2 = ssTot === 0 ? 1 : 1 - ssRes / ssTot;

  const xLast = xs[xs.length - 1];
  const project = (weeks: number) =>
    Math.max(0, intercept + slope * (xLast + weeks * 7));

  return {
    slopePerWeek: slope * 7,
    fittedLastLbs: Math.max(0, intercept + slope * xLast),
    projected4wkLbs: project(4),
    projected8wkLbs: project(8),
    r2,
    pointCount: n,
    windowFrom: window[0].date,
    windowTo: last.date,
  };
}

/** Fitted values at the window's last date and +8 weeks — the chart's dashed
 *  projection segment, guaranteed consistent with the tiles. */
export function trendSegment(
  trend: E1rmTrend,
): { fromDate: string; fromY: number; toDate: string; toY: number } {
  return {
    fromDate: trend.windowTo,
    fromY: trend.fittedLastLbs,
    toDate: addDaysIso(trend.windowTo, 56),
    toY: trend.projected8wkLbs,
  };
}

/** The muscle group an exercise most directly trains — its highest-scored
 *  muscle's group. Null for mobility work (no scores on purpose). */
function primaryMuscleGroup(exerciseId: ExerciseId): MuscleGroupId | null {
  const scores = scoresByExercise.get(exerciseId);
  if (!scores || scores.length === 0) return null;
  const top = scores.reduce((a, b) => (b.score > a.score ? b : a));
  return muscleById.get(top.muscleId)?.groupId ?? null;
}

export type LiftOverviewRow = LiftFrequency & {
  trendPerWeek: number | null;
  groupId: MuscleGroupId | null;
};

/** The unified lift list: frequency + best + 90-day trend + primary muscle
 *  group, ready for the Progress overview's sort/filter controls. */
export function liftOverview(data: GymData, clientId: ClientId): LiftOverviewRow[] {
  return liftFrequency(data, clientId).map((row) => {
    const trend =
      row.bestE1rmLbs === null
        ? null
        : e1rmTrend(exerciseHistory(data, clientId, row.exerciseId, row.modalityId));
    return {
      ...row,
      trendPerWeek: trend === null ? null : trend.slopePerWeek,
      groupId: primaryMuscleGroup(row.exerciseId),
    };
  });
}

const STATUS_ORDER = { neglected: 0, light: 1, solid: 2 } as const;

/** The per-muscle volume section's meter rows, shaped by the URL's sort and
 *  filter — moved from the library page when the section moved to Progress. */
export function volumeMeterGroups(
  data: GymData,
  clientId: ClientId,
  sort: "group" | "volume" | "status",
  filter: "all" | "needs-work",
): MeterGroup[] {
  const volume = muscleVolumeByGroup(data, clientId);
  const maxVolume = Math.max(
    ...volume.flatMap((g) => g.rows.map((r) => r.weightedVolumeLbs)),
  );
  const grouped: MeterGroup[] = volume.map((group) => ({
    groupId: group.groupId,
    label: group.label,
    rows: group.rows.map((row) => ({
      id: row.muscleId,
      name: row.name,
      peakScore: row.peakScore,
      value: row.weightedVolumeLbs,
      display:
        row.weightedVolumeLbs > 0
          ? `${Math.round(row.weightedVolumeLbs).toLocaleString()} lb`
          : "—",
      status: volumeStatus(row, maxVolume),
      ordinalNote:
        row.ordinalReps > 0 ? `+${Math.round(row.ordinalReps)} ord` : undefined,
    })),
  }));
  const flatRows = grouped.flatMap((g) => g.rows);
  const sorted: MeterGroup[] =
    sort === "volume"
      ? [{
          groupId: "all",
          label: "All muscles — most to least volume",
          rows: [...flatRows].sort((a, b) => b.value - a.value),
        }]
      : sort === "status"
        ? [{
            groupId: "all",
            label: "All muscles — worst first",
            rows: [...flatRows].sort(
              (a, b) =>
                STATUS_ORDER[a.status] - STATUS_ORDER[b.status] || a.value - b.value,
            ),
          }]
        : grouped;
  return sorted
    .map((g) => ({
      ...g,
      rows: filter === "needs-work" ? g.rows.filter((r) => r.status !== "solid") : g.rows,
    }))
    .filter((g) => g.rows.length > 0);
}

/** Best lifts inside one session, for the recent-workouts one-liners. */
export function sessionTopLifts(
  data: GymData,
  sessionId: string,
  limit = 2,
): { exerciseId: ExerciseId; modalityId: ModalityId; bestE1rmLbs: number }[] {
  return blocksFor(data, sessionId)
    .map((block) => ({
      exerciseId: block.exerciseId,
      modalityId: block.modalityId,
      bestE1rmLbs: bestE1rm(data, block.sets.filter((s) => s.completed && !s.isWarmup)),
    }))
    .filter((b): b is typeof b & { bestE1rmLbs: number } => b.bestE1rmLbs !== null)
    .sort((a, b) => b.bestE1rmLbs - a.bestE1rmLbs)
    .slice(0, limit);
}
