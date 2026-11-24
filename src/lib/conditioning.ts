import type { GymData } from "./gym-data";
import type { ChartPoint } from "./meters";
import { workingSets } from "./modality";
import { mmss, shortDayLabel, utcDay } from "./periods";
import type {
  ClientId,
  ConditioningLog,
  ConditioningTarget,
  ExerciseId,
  RoutineExercise,
  SetLog,
} from "./types";

/**
 * Conditioning pieces (Echo Bike): one SetLog per piece, carrying the
 * person's target (watts and/or RPM) and what the console read after STOP.
 * Pure, and kept out of every strength number: no pounds, no e1RM, no muscle
 * scores (see isStrengthPattern).
 *
 * Targets are per person. A routine row holds the default; after someone's
 * first piece their own last target rolls forward (Nate tweaks it on their
 * card), and it nudges up once they've met it twice in a row.
 */

export type IntervalScheme = { rounds: number; workSeconds: number; restSeconds: number };

const SCHEME = /^(\d{1,2})x(\d{1,3})\/(\d{1,3})$/;

/** "8x20/10" → 8 rounds of 20 s work / 10 s rest. Null for anything else. */
export function parseIntervalScheme(text: string | null): IntervalScheme | null {
  const m = text ? SCHEME.exec(text) : null;
  if (!m) return null;
  const [rounds, workSeconds, restSeconds] = [Number(m[1]), Number(m[2]), Number(m[3])];
  return rounds >= 1 && workSeconds >= 1 ? { rounds, workSeconds, restSeconds } : null;
}

export function formatIntervalScheme(s: IntervalScheme): string {
  return `${s.rounds}x${s.workSeconds}/${s.restSeconds}`;
}

/** The whole piece, rests included — the console's 20/10 ×8 is 4:00. */
export function schemeSeconds(s: IntervalScheme): number {
  return s.rounds * (s.workSeconds + s.restSeconds);
}

/** The Echo console's preset buttons (INT 20/10, INT 10/20 — 8 rounds each). */
export const CONSOLE_PRESETS = [
  { scheme: "8x20/10", label: "20/10 ×8" },
  { scheme: "8x10/20", label: "10/20 ×8" },
] as const;

/** A steady piece with no duration set — the console's manual mode, 5 min. */
export const DEFAULT_STEADY_SECONDS = 300;

/** A first-ever bike warm-up: the console's INT 20/10 button (4:00), which is
 *  what the household actually rides. After that, each person's last
 *  warm-up rolls forward (warmupPlan in warmup.ts). */
export const DEFAULT_WARMUP_SCHEME = "8x20/10";

export const EMPTY_TARGET: ConditioningTarget = {
  intervalScheme: null,
  targetWatts: null,
  targetRpm: null,
};

export const EMPTY_CONDITIONING: ConditioningLog = {
  ...EMPTY_TARGET,
  avgWatts: null,
  maxWatts: null,
  avgRpm: null,
  calories: null,
};

/** A set's conditioning fields, empty ones included. */
export function conditioningOf(set: Pick<SetLog, "conditioning">): ConditioningLog {
  return set.conditioning ?? EMPTY_CONDITIONING;
}

/** Just the target half — what a new piece is planned with. */
export function targetOf(t: ConditioningTarget): ConditioningTarget {
  return { intervalScheme: t.intervalScheme, targetWatts: t.targetWatts, targetRpm: t.targetRpm };
}

/** A piece's length: the scheme's total, else the row's duration, else 5:00. */
export function pieceSeconds(rx: Pick<RoutineExercise, "conditioning" | "durationSeconds">): number {
  const scheme = parseIntervalScheme(rx.conditioning?.intervalScheme ?? null);
  return scheme ? schemeSeconds(scheme) : (rx.durationSeconds ?? DEFAULT_STEADY_SECONDS);
}

/** "8 × 20/10" or "5:00 steady". */
export function pieceLabel(intervalScheme: string | null, durationSeconds: number | null): string {
  const scheme = parseIntervalScheme(intervalScheme);
  if (scheme) return `${scheme.rounds} × ${scheme.workSeconds}/${scheme.restSeconds}`;
  return durationSeconds !== null ? `${mmss(durationSeconds)} steady` : "steady";
}

/** "200 W", "55 rpm", "200 W · 70 rpm" — null with no target. */
export function targetLabel(t: ConditioningTarget): string | null {
  const parts = [
    t.targetWatts !== null ? `${t.targetWatts} W` : null,
    t.targetRpm !== null ? `${t.targetRpm} rpm` : null,
  ].filter((p) => p !== null);
  return parts.length > 0 ? parts.join(" · ") : null;
}

/** "182 W avg (410 max) · 64 rpm · 0.90 mi · 38 cal" — what was entered, in
 *  the console's reading order. */
export function readoutLabel(log: ConditioningLog, distanceFeet: number | null): string | null {
  const watts =
    log.avgWatts !== null
      ? `${log.avgWatts} W avg${log.maxWatts !== null ? ` (${log.maxWatts} max)` : ""}`
      : log.maxWatts !== null
        ? `${log.maxWatts} W max`
        : null;
  const parts = [
    watts,
    log.avgRpm !== null ? `${log.avgRpm} rpm` : null,
    distanceFeet !== null ? `${feetToMiles(distanceFeet).toFixed(2)} mi` : null,
    log.calories !== null ? `${log.calories} cal` : null,
  ].filter((p) => p !== null);
  return parts.length > 0 ? parts.join(" · ") : null;
}

const FEET_PER_MILE = 5280;

export function feetToMiles(feet: number): number {
  return feet / FEET_PER_MILE;
}

export function milesToFeet(miles: number): number {
  return Math.round(miles * FEET_PER_MILE);
}

/** How a logged piece compared with its target. `well_above` (>15% over) is
 *  the "are they pushing too hard?" flag. Null when nothing is comparable. */
export type TargetResult = "met" | "below" | "well_above";

const WELL_ABOVE = 1.15;

export function targetResult(log: ConditioningLog): TargetResult | null {
  const pairs = [
    [log.avgWatts, log.targetWatts],
    [log.avgRpm, log.targetRpm],
  ].filter((p): p is [number, number] => p[0] !== null && p[1] !== null);
  if (pairs.length === 0) return null;
  if (pairs.some(([avg, target]) => avg > target * WELL_ABOVE)) return "well_above";
  return pairs.every(([avg, target]) => avg >= target) ? "met" : "below";
}

export const TARGET_RESULT_LABELS: Record<TargetResult, string> = {
  met: "hit target",
  below: "below target",
  well_above: "well above target",
};

/** A person's completed pieces of one exercise, newest first. */
function pieces(data: GymData, clientId: ClientId, exerciseId: ExerciseId): SetLog[] {
  const date = (set: SetLog) => data.sessionById.get(set.sessionId)?.date ?? "";
  return workingSets(data, clientId, exerciseId)
    .filter((set) => set.conditioning !== null)
    .sort((a, b) => date(b).localeCompare(date(a)) || b.position - a.position);
}

/** A person's completed bike WARM-UPS of one exercise, newest first. Kept
 *  apart from pieces(): warm-up and finisher targets never feed each other. */
export function warmupPieces(data: GymData, clientId: ClientId, exerciseId: ExerciseId): SetLog[] {
  const date = (set: SetLog) => data.sessionById.get(set.sessionId)?.date ?? "";
  return data.setLogs
    .filter(
      (set) =>
        set.isWarmup &&
        set.completed &&
        set.exerciseId === exerciseId &&
        set.conditioning !== null &&
        data.sessionById.get(set.sessionId)?.clientId === clientId,
    )
    .sort((a, b) => date(b).localeCompare(date(a)) || b.position - a.position);
}

/** What makes two pieces comparable: the interval scheme, or a steady
 *  piece's length ("steady:300"). */
export function pieceShape(set: Pick<SetLog, "conditioning" | "durationSeconds">): string {
  return set.conditioning?.intervalScheme ?? `steady:${set.durationSeconds ?? DEFAULT_STEADY_SECONDS}`;
}

/** The dates of every bike piece a person has logged (any conditioning
 *  exercise, warm-ups excluded), newest first — one per piece. */
export function conditioningPieceDates(data: GymData, clientId: ClientId): string[] {
  return data.exercises
    .filter((e) => e.pattern === "conditioning")
    .flatMap((e) => pieces(data, clientId, e.id))
    .map((set) => data.sessionById.get(set.sessionId)?.date ?? "")
    .sort((a, b) => b.localeCompare(a));
}

const sameTarget = (a: ConditioningTarget, b: ConditioningTarget) =>
  a.intervalScheme === b.intervalScheme && a.targetWatts === b.targetWatts && a.targetRpm === b.targetRpm;

const hasTarget = (t: ConditioningTarget) => t.targetWatts !== null || t.targetRpm !== null;

/** +5% watts (rounded to 5, at least +5) and +2 RPM: small enough that a
 *  missed day doesn't matter, big enough to notice over a month. */
export function bumpTarget(t: ConditioningTarget): ConditioningTarget {
  return {
    ...t,
    targetWatts:
      t.targetWatts === null
        ? null
        : Math.max(t.targetWatts + 5, Math.round((t.targetWatts * 1.05) / 5) * 5),
    targetRpm: t.targetRpm === null ? null : t.targetRpm + 2,
  };
}

/**
 * The target for this person's next piece. With a routine row (`rx`), only
 * pieces of the same interval scheme count and the row supplies the scheme;
 * without one (added mid-session), their last piece of any scheme does and
 * its scheme comes along.
 *
 * Their own last target wins over the row's (that's where Nate's per-person
 * tweak lives); with no history the row's target is the start. Met (or
 * beaten) twice in a row at the current target → bumped once — the bumped
 * target then needs two more before the next.
 */
export function conditioningTarget(
  data: GymData,
  clientId: ClientId,
  exerciseId: ExerciseId,
  rx?: ConditioningTarget | null,
): ConditioningTarget {
  const scheme = rx === undefined ? undefined : (rx?.intervalScheme ?? null);
  const history = pieces(data, clientId, exerciseId)
    .map(conditioningOf)
    .filter((log) => hasTarget(log) && (scheme === undefined || log.intervalScheme === scheme));

  const last = history[0];
  if (!last) return rx ? targetOf(rx) : EMPTY_TARGET;
  const base = { ...targetOf(last), intervalScheme: scheme === undefined ? last.intervalScheme : scheme };
  return rollForward(history, base);
}

/** `base`, bumped once when the two newest pieces in `history` (newest
 *  first) were both done at exactly this target — same scheme too — and met
 *  or beat it. A piece of another scheme at the same watts never counts. */
export function rollForward(history: readonly ConditioningLog[], base: ConditioningTarget): ConditioningTarget {
  const beaten = (log: ConditioningLog) => {
    const result = targetResult(log);
    return sameTarget(log, base) && (result === "met" || result === "well_above");
  };
  return history.length >= 2 && beaten(history[0]) && beaten(history[1]) ? bumpTarget(base) : base;
}

/** "effort 6" — null when no effort was picked. */
export function effortLabel(log: Pick<ConditioningLog, "effort">): string | null {
  return log.effort != null ? `effort ${log.effort}` : null;
}

export type ConditioningPiece = {
  setId: string;
  date: string;
  piece: string;
  target: string | null;
  readout: string | null;
  result: TargetResult | null;
  effort: number | null;
};

export type ConditioningSummary = {
  /** Unique per section — an exercise's pieces and its warm-ups are two. */
  key: string;
  exerciseId: ExerciseId;
  name: string;
  /** Best average watts per day, oldest first — the Progress chart. */
  points: ChartPoint[];
  /** Newest first. */
  recent: ConditioningPiece[];
  /** "+18 W avg at effort 5 vs Oct 26" — warm-ups only, null until there's a
   *  fair comparison (warmupFitnessLine). */
  fitness: string | null;
};

/** Best average watts per day, oldest first, with the piece in the tooltip. */
function bestPerDay(data: GymData, sets: readonly SetLog[]): ChartPoint[] {
  const date = (set: SetLog) => data.sessionById.get(set.sessionId)?.date ?? "";
  const bestByDate = new Map<string, SetLog>();
  for (const set of sets) {
    const watts = conditioningOf(set).avgWatts;
    const best = bestByDate.get(date(set));
    if (watts !== null && (!best || watts > conditioningOf(best).avgWatts!)) {
      bestByDate.set(date(set), set);
    }
  }
  return [...bestByDate]
    .map(([d, set]): ChartPoint => ({
      date: d,
      y: conditioningOf(set).avgWatts!,
      sessionId: set.sessionId,
      detail: [
        d,
        pieceLabel(conditioningOf(set).intervalScheme, set.durationSeconds),
        readoutLabel(conditioningOf(set), set.distanceFeet),
        effortLabel(conditioningOf(set)),
      ]
        .filter((p) => p !== null)
        .join(" · "),
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

function recentPieces(data: GymData, sets: readonly SetLog[]): ConditioningPiece[] {
  return sets.map((set): ConditioningPiece => {
    const log = conditioningOf(set);
    return {
      setId: set.id,
      date: data.sessionById.get(set.sessionId)?.date ?? "",
      piece: pieceLabel(log.intervalScheme, set.durationSeconds),
      target: targetLabel(log),
      readout: readoutLabel(log, set.distanceFeet),
      result: targetResult(log),
      effort: log.effort ?? null,
    };
  });
}

/** One person's conditioning, per exercise, for the Progress tab (finisher
 *  pieces; warm-ups are their own series — warmupSummary). */
export function conditioningSummaries(
  data: GymData,
  clientId: ClientId,
  recentLimit = 5,
): ConditioningSummary[] {
  return data.exercises
    .filter((e) => e.pattern === "conditioning")
    .flatMap((exercise) => {
      const all = pieces(data, clientId, exercise.id);
      if (all.length === 0) return [];
      return [
        {
          key: exercise.id,
          exerciseId: exercise.id,
          name: exercise.name,
          points: bestPerDay(data, all),
          recent: recentPieces(data, all.slice(0, recentLimit)),
          fitness: null,
        },
      ];
    });
}

/**
 * A person's bike warm-ups as their own Progress series. Only like-for-like
 * pieces are charted — the shape (scheme, or a steady piece's length) of the
 * newest warm-up — so switching from 5:00 steady to 20/10 doesn't read as a
 * jump in fitness. The recent list shows every shape. Null with none logged.
 */
export function warmupSummary(
  data: GymData,
  clientId: ClientId,
  exerciseId: ExerciseId,
  recentLimit = 5,
): ConditioningSummary | null {
  const all = warmupPieces(data, clientId, exerciseId);
  if (all.length === 0) return null;
  const shape = pieceShape(all[0]);
  const same = all.filter((set) => pieceShape(set) === shape);
  const date = (set: SetLog) => data.sessionById.get(set.sessionId)?.date ?? "";
  return {
    key: `${exerciseId}:warmup`,
    exerciseId,
    name: `Warm-up · ${pieceLabel(all[0].conditioning?.intervalScheme ?? null, all[0].durationSeconds)}`,
    points: bestPerDay(data, same),
    recent: recentPieces(data, all.slice(0, recentLimit)),
    fitness: warmupFitnessLine(same.map((set) => ({ date: date(set), log: conditioningOf(set) }))),
  };
}

/** How far back a fair fitness comparison looks: long enough for real
 *  adaptation, short enough that it's still "lately". */
const FITNESS_MIN_DAYS = 21;
const FITNESS_MAX_DAYS = 42;

/**
 * "+18 W avg at effort 5 vs Oct 26": the newest same-shape piece with watts
 * and an effort, against the newest one 3–6 weeks older at the SAME effort.
 * More watts for the same felt effort is the honest "getting fitter" signal
 * for an easy warm-up (targets alone just measure how hard you pushed).
 * `pieces` newest first, all one shape. Null without a fair pair.
 */
export function warmupFitnessLine(pieces: readonly { date: string; log: ConditioningLog }[]): string | null {
  const rated = pieces.filter((p) => p.log.avgWatts !== null && p.log.effort != null);
  const latest = rated[0];
  if (!latest) return null;
  const then = rated.find((p) => {
    const days = utcDay(latest.date) - utcDay(p.date);
    return p.log.effort === latest.log.effort && days >= FITNESS_MIN_DAYS && days <= FITNESS_MAX_DAYS;
  });
  if (!then) return null;
  const delta = latest.log.avgWatts! - then.log.avgWatts!;
  const sign = delta > 0 ? "+" : delta < 0 ? "−" : "±";
  return `${sign}${Math.abs(delta)} W avg at effort ${latest.log.effort} vs ${shortDayLabel(then.date)}`;
}
