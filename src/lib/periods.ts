import type { GymData } from "./gym-data";
import type { ClientId } from "./types";

/**
 * THE date module. Two blessed forms only: display/storage dates are LOCAL
 * ISO strings (yyyy-mm-dd via en-CA), regression math uses UTC day numbers
 * (utcDay) — never mix them, and never round-trip a yyyy-mm-dd string
 * through `new Date(...)` for display (it shifts a day west of UTC).
 */

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
  const date = new Date(`${iso}T00:00:00`);
  date.setDate(date.getDate() + days);
  return date.toLocaleDateString("en-CA");
}

/** Monday of the week containing the date — the schema's week starts Monday. */
export function mondayOf(iso: string): string {
  const date = new Date(`${iso}T00:00:00`);
  const offset = (date.getDay() + 6) % 7;
  return addDaysIso(iso, -offset);
}

/** A Date as a LOCAL yyyy-mm-dd string — the blessed conversion; never use
 *  `toISOString().slice(0, 10)`, which is a day off west of UTC every evening. */
export function localIso(date: Date): string {
  return date.toLocaleDateString("en-CA");
}

export function localTodayIso(): string {
  return localIso(new Date());
}

/** Today's weekday in the schema's numbering: 1 = Monday .. 7 = Sunday. */
export function todayDow(): number {
  return ((new Date().getDay() + 6) % 7) + 1;
}

/** Days since epoch, in UTC — immune to DST and local offsets. For trend
 *  math only, never display. */
export function utcDay(date: string): number {
  return new Date(`${date}T00:00:00Z`).getTime() / 86_400_000;
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
