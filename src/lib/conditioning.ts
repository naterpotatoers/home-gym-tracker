import type { GymData } from "./gym-data";
import type { ChartPoint } from "./meters";
import { workingSets } from "./modality";
import { mmss } from "./periods";
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

/** "182 W avg (410 max) · 64 rpm · 38 cal · 0.90 mi" — what was entered. */
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
    log.calories !== null ? `${log.calories} cal` : null,
    distanceFeet !== null ? `${feetToMiles(distanceFeet).toFixed(2)} mi` : null,
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
  a.targetWatts === b.targetWatts && a.targetRpm === b.targetRpm;

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

  const beaten = (log: ConditioningLog) => {
    const result = targetResult(log);
    return sameTarget(log, base) && (result === "met" || result === "well_above");
  };
  return history.length >= 2 && beaten(history[0]) && beaten(history[1]) ? bumpTarget(base) : base;
}

export type ConditioningPiece = {
  setId: string;
  date: string;
  piece: string;
  target: string | null;
  readout: string | null;
  result: TargetResult | null;
};

export type ConditioningSummary = {
  exerciseId: ExerciseId;
  name: string;
  /** Best average watts per day, oldest first — the Progress chart. */
  points: ChartPoint[];
  /** Newest first. */
  recent: ConditioningPiece[];
};

/** One person's conditioning, per exercise, for the Progress tab. */
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
      const date = (set: SetLog) => data.sessionById.get(set.sessionId)?.date ?? "";

      const bestByDate = new Map<string, SetLog>();
      for (const set of all) {
        const watts = conditioningOf(set).avgWatts;
        const best = bestByDate.get(date(set));
        if (watts !== null && (!best || watts > conditioningOf(best).avgWatts!)) {
          bestByDate.set(date(set), set);
        }
      }
      const points = [...bestByDate]
        .map(([d, set]): ChartPoint => ({
          date: d,
          y: conditioningOf(set).avgWatts!,
          sessionId: set.sessionId,
          detail: `${d} · ${pieceLabel(conditioningOf(set).intervalScheme, set.durationSeconds)} · ${readoutLabel(conditioningOf(set), set.distanceFeet)}`,
        }))
        .sort((a, b) => a.date.localeCompare(b.date));

      const recent = all.slice(0, recentLimit).map((set): ConditioningPiece => {
        const log = conditioningOf(set);
        return {
          setId: set.id,
          date: date(set),
          piece: pieceLabel(log.intervalScheme, set.durationSeconds),
          target: targetLabel(log),
          readout: readoutLabel(log, set.distanceFeet),
          result: targetResult(log),
        };
      });
      return [{ exerciseId: exercise.id, name: exercise.name, points, recent }];
    });
}
