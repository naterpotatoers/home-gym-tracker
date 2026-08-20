import type { GymData } from "./gym-data";
import type { ClientId } from "./types";

/**
 * THE date module. Two blessed forms only: display/storage dates are GYM-ZONE
 * ISO strings (yyyy-mm-dd via en-CA in GYM_TZ), regression math uses UTC day
 * numbers (utcDay) — never mix them. ISO-string helpers below anchor to UTC
 * internally so they behave identically on any host; only the wall clock
 * (`new Date()`) ever passes through GYM_TZ.
 */

/** The gym's wall clock. Vercel runs the server in UTC; "today" and the
 *  weekday must be computed in the gym's zone, never the process zone.
 *  NEXT_PUBLIC_ so the value inlines identically into server and client
 *  bundles (this module is imported by 'use client' components too). */
const GYM_TZ = process.env.NEXT_PUBLIC_GYM_TZ ?? "America/Los_Angeles";

export type PeriodKind = "day" | "week" | "program" | "custom";

export type ResolvedPeriod = {
  from: string;
  to: string;
  label: string;
  /** Anchor date for the previous/next period, or null when stepping makes no
   *  sense (program spans, custom ranges). */
  prevAnchor: string | null;
  nextAnchor: string | null;
};

export function addDaysIso(iso: string, days: number): string {
  const date = new Date(`${iso}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  // Safe here (and only here): the Date is UTC-anchored, not a wall clock.
  return date.toISOString().slice(0, 10);
}

/** Weekday of an ISO day in the schema's numbering: 1 = Monday .. 7 = Sunday. */
export function isoDow(iso: string): number {
  return ((new Date(`${iso}T00:00:00Z`).getUTCDay() + 6) % 7) + 1;
}

/** Monday of the week containing the date — the schema's week starts Monday. */
export function mondayOf(iso: string): string {
  return addDaysIso(iso, -(isoDow(iso) - 1));
}

/** A wall-clock instant as the gym's yyyy-mm-dd — the blessed conversion;
 *  never use `toISOString().slice(0, 10)` on a wall clock (a day off every
 *  evening) or bare `toLocaleDateString` (the process zone, UTC on Vercel). */
export function localIso(date: Date): string {
  return date.toLocaleDateString("en-CA", { timeZone: GYM_TZ });
}

export function localTodayIso(): string {
  return localIso(new Date());
}

/** Human label for a gym-zone ISO day — "Tuesday, August 5". Display only. */
export function localDayLabel(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}

/** Today's weekday at the gym — derived from the same ISO string as
 *  localTodayIso() so the two can never disagree across midnight. */
export function todayDow(): number {
  return isoDow(localTodayIso());
}

/** Whole years between two ISO days — pure string math, no Date. */
export function ageOnIso(dobIso: string, asOfIso: string): number {
  return (
    Number(asOfIso.slice(0, 4)) -
    Number(dobIso.slice(0, 4)) -
    (asOfIso.slice(5) < dobIso.slice(5) ? 1 : 0)
  );
}

/** Weekday labels in the schema's numbering — index with `dayOfWeek - 1`. */
export const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

/** "3:07" — countdown/elapsed display for whole seconds. */
export function mmss(totalSeconds: number): string {
  return `${Math.floor(totalSeconds / 60)}:${String(totalSeconds % 60).padStart(2, "0")}`;
}

/** Days since epoch, in UTC — immune to DST and local offsets. For trend
 *  math only, never display. */
export function utcDay(date: string): number {
  return new Date(`${date}T00:00:00Z`).getTime() / 86_400_000;
}

/** Which 1-based program week a date falls in, clamped into the program —
 *  before the start it's week 1, past the end the final week keeps being
 *  offered (matches the week grid's behavior). */
export function currentProgramWeek(
  assignment: { startDate: string },
  program: { weeks: number },
  todayIso: string,
): number {
  const elapsed = Math.floor((utcDay(todayIso) - utcDay(assignment.startDate)) / 7);
  return Math.min(Math.max(elapsed + 1, 1), Math.max(program.weeks, 1));
}

export function resolvePeriod(
  data: GymData,
  clientId: ClientId,
  params: {
    period: PeriodKind;
    date?: string;
    from?: string;
    to?: string;
    program?: string;
  },
): ResolvedPeriod {
  const anchor = params.date ?? localTodayIso();

  switch (params.period) {
    case "day":
      return {
        from: anchor,
        to: anchor,
        label: anchor,
        prevAnchor: addDaysIso(anchor, -1),
        nextAnchor: addDaysIso(anchor, 1),
      };
    case "week": {
      const monday = mondayOf(anchor);
      return {
        from: monday,
        to: addDaysIso(monday, 6),
        label: `Week of ${monday}`,
        prevAnchor: addDaysIso(monday, -7),
        nextAnchor: addDaysIso(monday, 7),
      };
    }
    case "program": {
      const assignment =
        (params.program
          ? data.assignments.find(
              (a) => a.clientId === clientId && a.programId === params.program,
            )
          : undefined) ??
        data.assignments.find((a) => a.clientId === clientId && a.status === "active") ??
        data.assignments.find((a) => a.clientId === clientId);
      if (!assignment) {
        // No program history: fall back to the trailing 8 weeks.
        const today = localTodayIso();
        return {
          from: addDaysIso(today, -55),
          to: today,
          label: "No program assigned — last 8 weeks",
          prevAnchor: null,
          nextAnchor: null,
        };
      }
      const program = data.programById.get(assignment.programId);
      const weeks = program?.weeks ?? 8;
      return {
        from: assignment.startDate,
        to: addDaysIso(assignment.startDate, weeks * 7 - 1),
        label: `${program?.name ?? assignment.programId} (${assignment.startDate})`,
        prevAnchor: null,
        nextAnchor: null,
      };
    }
    case "custom": {
      const today = localTodayIso();
      const from = params.from ?? addDaysIso(today, -29);
      const to = params.to ?? today;
      return { from, to, label: `${from} → ${to}`, prevAnchor: null, nextAnchor: null };
    }
  }
}
