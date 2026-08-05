import Link from "next/link";
import { ConfirmDeleteButton } from "@/components/confirm-delete-button";
import { CalendarIcon } from "@/components/icons";
import { StartWorkoutSubmit } from "@/components/start-workout-submit";
import {
  Checkbox,
  chipClass,
  clientBorderStyle,
  ColorDot,
  Note,
  PageShell,
  Select,
} from "@/components/ui";
import { startGroupFromForm } from "@/lib/actions/group";
import { discardSession } from "@/lib/actions/workout";
import { loadGymData } from "@/lib/db/snapshot";
import { localTodayIso, todayDow } from "@/lib/periods";
import { clientSummaries, openBoardGroups, routineForDay } from "@/lib/queries";

/**
 * The one workout entry point: check who's training, confirm each person's
 * plan, hit start. One person checked = solo session, straight into the
 * runner; more = the shared group board.
 */
export default async function WorkoutPage() {
  const data = await loadGymData();
  const dow = todayDow();
  const today = localTodayIso();
  const routines = [...data.routines].sort((a, b) => a.name.localeCompare(b.name));
  const summaries = new Map(
    clientSummaries(data).map((s) => [s.client.id, s]),
  );

  const boardGroups = openBoardGroups(data);

  const rows = data.clients.map((client) => {
    const planned = data.sessions
      .filter((s) => s.clientId === client.id && s.status === "planned")
      .sort((a, b) => b.date.localeCompare(a.date));
    const assignment = data.assignments.find(
      (a) => a.clientId === client.id && a.status === "active",
    );
    const todaysRoutine = routineForDay(data, client.id, dow, today);
    const defaultPlan = planned[0]
      ? `resume:${planned[0].id}`
      : todaysRoutine
        ? `${todaysRoutine.routineId}|${assignment?.id ?? ""}`
        : `${routines[0]?.id ?? ""}|`;
    return { client, planned, assignment, todaysRoutine, defaultPlan };
  });

  return (
    <PageShell className="max-w-4xl">
      <h1 className="text-3xl font-bold tracking-tight">Start a workout</h1>
      <p className="mt-2 text-sm text-muted">
        Check who&apos;s training and confirm their plan. One person goes
        straight into logging; more than one opens the shared board.
      </p>

      <form action={startGroupFromForm} className="mt-8 space-y-3">
        {rows.map(({ client, planned, assignment, todaysRoutine, defaultPlan }) => {
          const summary = summaries.get(client.id);
          return (
            <label
              key={client.id}
              className="grid grid-cols-[auto_1fr_auto] items-center gap-x-3 gap-y-2 rounded-xl border border-border bg-surface px-4 py-3 sm:grid-cols-[auto_11rem_1fr_auto]"
              style={clientBorderStyle(client.color)}
            >
              <Checkbox name={`include_${client.id}`} />
              <span className="min-w-0">
                <span className="flex items-center gap-1.5 font-semibold">
                  <ColorDot color={client.color} />
                  {client.firstName}
                </span>
                <span className="block text-xs text-muted">
                  {summary
                    ? `${summary.sessionCount} sessions${
                        summary.lastSessionDate ? ` · last ${summary.lastSessionDate}` : ""
                      }`
                    : "no sessions yet"}
                </span>
              </span>
              <Select
                name={`plan_${client.id}`}
                defaultValue={defaultPlan}
                className="col-span-3 w-full sm:col-span-1"
              >
                {planned.map((s) => (
                  <option key={s.id} value={`resume:${s.id}`}>
                    Resume: {data.routineById.get(s.routineId ?? "")?.name ?? "session"}{" "}
                    ({s.date})
                  </option>
                ))}
                {todaysRoutine && (
                  <option value={`${todaysRoutine.routineId}|${assignment?.id ?? ""}`}>
                    {data.routineById.get(todaysRoutine.routineId)?.name} — today&apos;s
                    program day
                  </option>
                )}
                {routines.map((routine) => (
                  <option key={routine.id} value={`${routine.id}|`}>
                    {routine.name}
                  </option>
                ))}
              </Select>
              <Link
                href={`/workout/${client.id}`}
                className={`col-start-3 row-start-1 sm:col-start-4 ${chipClass(false, "min-h-9 whitespace-nowrap px-2.5 text-xs")}`}
              >
                <CalendarIcon size={14} /> Program
              </Link>
              {planned.length > 0 && (
                <div className="col-span-3 mt-1 rounded-lg bg-background px-3 py-2 sm:col-span-4">
                  <span className="text-[11px] uppercase tracking-wide text-muted">
                    Unfinished sessions
                  </span>
                  {planned.map((s) => {
                    const name =
                      data.routineById.get(s.routineId ?? "")?.name ?? "session";
                    return (
                      <div key={s.id} className="flex min-h-9 items-center gap-2 text-sm">
                        <span className="truncate">{name}</span>
                        <span className="font-mono text-xs text-muted">{s.date}</span>
                        <ConfirmDeleteButton
                          action={discardSession.bind(null, s.id)}
                          confirmText={`Discard ${name} (${s.date})? Any sets already logged in it are deleted.`}
                          ariaLabel={`Discard ${name} (${s.date})`}
                          className="ml-auto text-danger-text"
                        />
                      </div>
                    );
                  })}
                </div>
              )}
            </label>
          );
        })}

        <StartWorkoutSubmit />
      </form>

      {boardGroups.length > 0 && (
        <div className="mt-6 space-y-1">
          {boardGroups.map(({ date, sessionIds }) => (
            <Link
              key={date}
              href={`/workout/group/board?s=${sessionIds.join(",")}`}
              className="block text-sm font-semibold text-accent-text underline underline-offset-2"
            >
              Resume group board — {date} ({sessionIds.length} people) →
            </Link>
          ))}
        </div>
      )}
      <Note>
        Every unfinished session shows up as its own Resume option in the plan
        list — discard the ones that never really happened.
      </Note>
    </PageShell>
  );
}
