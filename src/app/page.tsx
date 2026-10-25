import Link from "next/link";
import { PlayIcon } from "@/components/icons";
import { Chip, PageShell } from "@/components/ui";
import { WorkoutLauncher, type LauncherRow } from "@/components/workout-launcher";
import { loadGymData } from "@/lib/db/snapshot";
import { localDayLabel, localTodayIso, todayDow } from "@/lib/periods";
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
    const todaysRoutine = routineForDay(data, client.id, dow, today);

    const options = [
      ...planned.map((s) => ({
        value: `resume:${s.id}`,
        label: `Resume: ${routineName(s.routineId)} (${s.date})`,
      })),
      ...(todaysRoutine
        ? [
            {
              value: `${todaysRoutine.routineId}|${assignment?.id ?? ""}`,
              label: `${routineName(todaysRoutine.routineId)} — today's program day`,
            },
          ]
        : []),
      ...routines.map((routine) => ({ value: `${routine.id}|`, label: routine.name })),
    ];
    // No resume and no program day: default to what they did last rather than
    // whichever routine sorts first alphabetically.
    const lastRoutineId = data.sessions
      .filter((s) => s.clientId === client.id && s.status === "completed" && s.routineId)
      .sort((a, b) => b.date.localeCompare(a.date))[0]?.routineId;
    const lastValue = `${lastRoutineId}|`;
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
      unfinished: planned.map((s) => ({
        id: s.id,
        name: routineName(s.routineId),
        date: s.date,
      })),
    };
  });

  return (
    <PageShell className="max-w-3xl">
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
    </PageShell>
  );
}
