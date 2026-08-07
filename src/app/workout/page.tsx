import Link from "next/link";
import { ConfirmDeleteButton } from "@/components/confirm-delete-button";
import { CalendarIcon } from "@/components/icons";
import { StartRowButton } from "@/components/start-row-button";
import { StartWorkoutSubmit } from "@/components/start-workout-submit";
import {
  Checkbox,
  Chip,
  chipClass,
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
  const routines = [...data.routines].sort((a, b) =>
    a.name.localeCompare(b.name),
  );
  const summaries = new Map(clientSummaries(data).map((s) => [s.client.id, s]));

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
        Check who&apos;s training and confirm their plan. One client goes
        straight into logging; more than one opens the shared board.
      </p>

      {boardGroups.length > 0 && (
        <ul className="mt-6 divide-y divide-border rounded-xl border border-border bg-surface text-sm">
          {boardGroups.map(({ date, sessionIds }) => {
            const clients = sessionIds
              .map((id) => data.sessionById.get(id)?.clientId)
              .map((cid) => data.clientById.get(cid ?? ""))
              .filter(Boolean);
            return (
              <li
                key={date}
                className="flex flex-wrap items-center gap-2 px-4 py-3"
              >
                <span className="font-mono text-xs text-muted">{date}</span>
                {clients.map((c) => (
                  <Chip key={c!.id}>{c!.firstName}</Chip>
                ))}
                <StartRowButton
                  isResume
                  href={`/workout/group/board?s=${sessionIds.join(",")}`}
                  className="ml-auto"
                />
              </li>
            );
          })}
        </ul>
      )}

      <form id="workout-form" action={startGroupFromForm} className="mt-8">
        <ul className="divide-y divide-border rounded-xl border border-border bg-surface text-sm">
          {rows.map(
            ({ client, planned, assignment, todaysRoutine, defaultPlan }) => {
              const summary = summaries.get(client.id);
              const isResume = defaultPlan.startsWith("resume:");
              return (
                <li key={client.id}>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3">
                    <label className="cursor-pointer">
                      <Checkbox name={`include_${client.id}`} />
                    </label>
                    <ColorDot color={client.color} size="md" />
                    <span className="min-w-0 flex-1 basis-32">
                      <span className="block font-semibold">
                        {client.firstName}
                      </span>
                      <span className="block truncate text-xs text-muted">
                        {summary
                          ? `${summary.sessionCount} sessions${
                              summary.lastSessionDate
                                ? ` · last ${summary.lastSessionDate}`
                                : ""
                            }`
                          : "no sessions yet"}
                      </span>
                    </span>
                    <Select
                      name={`plan_${client.id}`}
                      defaultValue={defaultPlan}
                      size="sm"
                      className="flex-1 basis-44"
                    >
                      {planned.map((s) => (
                        <option key={s.id} value={`resume:${s.id}`}>
                          Resume:{" "}
                          {data.routineById.get(s.routineId ?? "")?.name ??
                            "session"}{" "}
                          ({s.date})
                        </option>
                      ))}
                      {todaysRoutine && (
                        <option
                          value={`${todaysRoutine.routineId}|${assignment?.id ?? ""}`}
                        >
                          {data.routineById.get(todaysRoutine.routineId)?.name}{" "}
                          — today&apos;s program day
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
                      className={chipClass(
                        false,
                        "hidden min-h-9 whitespace-nowrap px-2.5 text-xs sm:inline-flex",
                      )}
                    >
                      <CalendarIcon size={14} /> Program
                    </Link>
                    <StartRowButton clientId={client.id} isResume={isResume} />
                  </div>

                  {planned.length > 0 && (
                    <div className="mx-4 mb-3 rounded-lg bg-background px-3 py-2">
                      <span className="text-[11px] uppercase tracking-wide text-muted">
                        Unfinished sessions
                      </span>
                      {planned.map((s) => {
                        const name =
                          data.routineById.get(s.routineId ?? "")?.name ??
                          "session";
                        return (
                          <div
                            key={s.id}
                            className="flex min-h-9 items-center gap-2 text-sm"
                          >
                            <span className="truncate">{name}</span>
                            <span className="font-mono text-xs text-muted">
                              {s.date}
                            </span>
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
                </li>
              );
            },
          )}
        </ul>

        <div className="mt-4">
          <StartWorkoutSubmit />
        </div>
      </form>

      <Note>
        Every unfinished session shows up as its own Resume option in the plan
        list — discard the ones that never really happened.
      </Note>
    </PageShell>
  );
}
