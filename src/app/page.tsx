import Link from "next/link";
import { PlayIcon } from "@/components/icons";
import { Chip, PageShell } from "@/components/ui";
import { RunningCard, type RunnerSummary } from "@/components/running-card";
import { WorkoutLauncher, type LauncherRow } from "@/components/workout-launcher";
import { loadGymData } from "@/lib/db/snapshot";
import { isCareRoutine } from "@/lib/data/care-routines";
import {
  addDaysIso,
  DAY_LABELS,
  hmmss,
  isoDow,
  localDayLabel,
  localTodayIso,
  programEnded,
  shortDayLabel,
  todayDow,
} from "@/lib/periods";
import {
  milesLabel,
  paceLabel,
  RUN_KIND_LABELS,
  runsFor,
  runWeek,
  weeklyMiles,
} from "@/lib/running";
import { stravaAthlete } from "@/lib/strava";
import { openBoardGroups, routineForDay } from "@/lib/queries";

/**
 * Home IS the workout launcher: tap who's training, confirm each person's
 * plan, one Start. One person = solo runner; more = the shared group board.
 * Anyone with an unfinished session or a program day today starts checked.
 */
export default async function Home() {
  const data = await loadGymData();
  const dow = todayDow();
  const today = localTodayIso();
  const routines = [...data.routines].sort((a, b) => a.name.localeCompare(b.name));
  const routineName = (id: string | null) =>
    data.routineById.get(id ?? "")?.name ?? "session";

  const boardGroups = openBoardGroups(data);

  const rows: LauncherRow[] = data.clients.map((client) => {
    const planned = data.sessions
      .filter((s) => s.clientId === client.id && s.status === "planned")
      .sort((a, b) => b.date.localeCompare(a.date));
    const assignment = data.assignments.find(
      (a) => a.clientId === client.id && a.status === "active",
    );
    const program = assignment ? data.programById.get(assignment.programId) : undefined;
    const ended = !!assignment && !!program && programEnded(assignment, program, today);
    const todaysRoutine = routineForDay(data, client.id, dow, today);

    // Grouped so the program you're on leads and one-off care work sits at
    // the bottom (it's also offered as a finisher after a workout).
    const programGroup = program && !ended ? program.name : null;
    const programRoutineIds = new Set(
      programGroup
        ? data.programDays.filter((d) => d.programId === program!.id).map((d) => d.routineId)
        : [],
    );
    const options: LauncherRow["options"] = [
      ...planned.map((s) => ({
        value: `resume:${s.id}`,
        label: `Resume: ${routineName(s.routineId)} (${s.date})`,
        group: "Resume",
      })),
      ...(todaysRoutine
        ? [
            {
              value: `${todaysRoutine.routineId}|${assignment?.id ?? ""}`,
              label: `${routineName(todaysRoutine.routineId)} — today's program day`,
              group: programGroup ?? "Program",
            },
          ]
        : []),
      ...routines
        .filter((r) => programRoutineIds.has(r.id) && r.id !== todaysRoutine?.routineId)
        .map((r) => ({ value: `${r.id}|${assignment?.id ?? ""}`, label: r.name, group: programGroup! })),
      ...routines
        .filter((r) => !programRoutineIds.has(r.id) && !isCareRoutine(r))
        .map((r) => ({ value: `${r.id}|`, label: r.name, group: "Other routines" })),
      ...routines
        .filter((r) => !programRoutineIds.has(r.id) && isCareRoutine(r))
        .map((r) => ({ value: `${r.id}|`, label: r.name, group: "Care & mobility" })),
    ];
    // No resume and no program day: default to what they did last rather than
    // whichever routine sorts first alphabetically.
    const lastRoutineId = data.sessions
      .filter((s) => s.clientId === client.id && s.status === "completed" && s.routineId)
      .sort((a, b) => b.date.localeCompare(a.date))[0]?.routineId;
    // Program routines carry the assignment in their value.
    const lastValue =
      options.find((o) => o.value.startsWith(`${lastRoutineId}|`) && !o.value.startsWith("resume:"))
        ?.value ?? `${lastRoutineId}|`;
    const defaultPlan =
      planned.length > 0 || todaysRoutine || !options.some((o) => o.value === lastValue)
        ? (options[0]?.value ?? "")
        : lastValue;

    return {
      clientId: client.id,
      firstName: client.firstName,
      color: client.color,
      options,
      defaultPlan,
      defaultChecked: planned.length > 0 || todaysRoutine !== null,
      finishedProgram:
        ended && assignment && program
          ? { assignmentId: assignment.id, programName: program.name }
          : null,
      unfinished: planned.map((s) => ({
        id: s.id,
        name: routineName(s.routineId),
        date: s.date,
      })),
    };
  });

  // Running: the Strava athlete plus anyone who has run in the last 6 weeks.
  const athlete = stravaAthlete();
  const sixWeeksAgo = addDaysIso(today, -42);
  const runners: RunnerSummary[] = data.clients
    .filter(
      (c) =>
        c.id === athlete || data.runs.some((r) => r.clientId === c.id && r.date >= sixWeeksAgo),
    )
    .map((client) => {
      const week = runWeek(data, client.id, today);
      const recent = week.runs.length > 0 ? week.runs : runsFor(data, client.id).slice(0, 3);
      return {
        clientId: client.id,
        firstName: client.firstName,
        color: client.color,
        weekRuns: week.runs.length,
        weekMiles: milesLabel(week.miles),
        weekly: weeklyMiles(data, client.id, today).map((w) => ({
          label: shortDayLabel(w.weekStart),
          miles: w.miles,
        })),
        recent: recent.map((r) => ({
          id: r.id,
          dayLabel: week.runs.includes(r)
            ? DAY_LABELS[isoDow(r.date) - 1]
            : shortDayLabel(r.date),
          kind: r.kind,
          kindLabel: RUN_KIND_LABELS[r.kind],
          miles: milesLabel(r.distanceMiles),
          time: hmmss(r.durationSeconds),
          pace: paceLabel(r),
          heartRate: r.avgHeartRate,
          name: r.name,
          fromStrava: r.source === "strava",
        })),
        strava: client.id === athlete,
      };
    });

  return (
    <PageShell>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-3xl font-bold tracking-tight">Today</h1>
        <span className="text-sm text-muted">{localDayLabel(today)}</span>
      </div>

      {boardGroups.length > 0 && (
        <ul className="mt-6 space-y-2">
          {boardGroups.map(({ date, sessionIds }) => (
            <li key={date}>
              <Link
                href={`/workout/group/board?s=${sessionIds.join(",")}`}
                className="flex min-h-11 flex-wrap items-center gap-2 rounded-xl border border-accent/50 bg-accent-soft px-4 py-3 text-sm hover:bg-accent/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
              >
                <PlayIcon size={16} />
                <span className="font-semibold text-accent-text">Resume group board</span>
                <span className="font-mono text-xs text-muted">{date}</span>
                {sessionIds.map((id) => {
                  const client = data.clientById.get(data.sessionById.get(id)?.clientId ?? "");
                  return client ? <Chip key={id}>{client.firstName}</Chip> : null;
                })}
              </Link>
            </li>
          ))}
        </ul>
      )}

      {/* Landscape (lg+): the launcher leads, running rides alongside in a
          side column; stacked on phones and iPad portrait. */}
      <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start lg:gap-8">
        {rows.length === 0 ? (
          <p className="mt-6 text-sm text-muted">
            No clients yet — add the first one at{" "}
            <Link href="/users" className="text-accent-text underline underline-offset-2">
              Clients
            </Link>
            .
          </p>
        ) : (
          <WorkoutLauncher rows={rows} />
        )}

        {data.runsSource === "missing" ? (
          <p className="mt-8 rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-xs lg:mt-6">
            Running isn&apos;t set up yet — run{" "}
            <code className="font-mono">supabase/migrations/2026-11-07-runs.sql</code> in the
            Supabase SQL editor, then reload.
          </p>
        ) : (
          rows.length > 0 && (
            <RunningCard
              runners={runners}
              clients={data.clients.map((c) => ({ id: c.id, firstName: c.firstName }))}
              today={today}
              className="mt-8 lg:mt-6"
            />
          )
        )}
      </div>
    </PageShell>
  );
}
