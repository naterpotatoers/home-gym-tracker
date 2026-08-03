import Link from "next/link";
import { Button, clientBorderStyle, Note, PageShell, SeedBanner, Select } from "@/components/ui";
import { startGroupFromForm } from "@/lib/actions/group";
import { loadGymData } from "@/lib/db/snapshot";
import { todayDow } from "@/lib/periods";
import { clientSummaries, routineForDay } from "@/lib/queries";

/**
 * The one workout entry point: check who's training, confirm each person's
 * plan, hit start. One person checked = solo session, straight into the
 * runner; more = the shared group board.
 */
export default async function WorkoutPage() {
  const data = await loadGymData();
  const dow = todayDow();
  const routines = [...data.routines].sort((a, b) => a.name.localeCompare(b.name));
  const summaries = new Map(
    clientSummaries(data).map((s) => [s.client.id, s]),
  );

  const rows = data.clients.map((client) => {
    const planned = data.sessions.find(
      (s) => s.clientId === client.id && s.status === "planned",
    );
    const assignment = data.assignments.find(
      (a) => a.clientId === client.id && a.status === "active",
    );
    const todaysRoutine = routineForDay(data, client.id, dow);
    const defaultPlan = planned
      ? `resume:${planned.id}`
      : todaysRoutine
        ? `${todaysRoutine.routineId}|${assignment?.id ?? ""}`
        : `${routines[0]?.id ?? ""}|`;
    return { client, planned, assignment, todaysRoutine, defaultPlan };
  });

  return (
    <PageShell className="max-w-4xl">
      {data.source === "seed" && <SeedBanner />}
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
              <input
                type="checkbox"
                name={`include_${client.id}`}
                defaultChecked={planned !== undefined || todaysRoutine !== null}
                className="size-5 accent-accent"
              />
              <span className="min-w-0">
                <span className="flex items-center gap-1.5 font-semibold">
                  {client.color && (
                    <span
                      className="size-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: client.color }}
                    />
                  )}
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
                {planned && (
                  <option value={`resume:${planned.id}`}>
                    Resume: {data.routineById.get(planned.routineId ?? "")?.name ?? "session"}{" "}
                    ({planned.date})
                  </option>
                )}
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
                className="col-start-3 row-start-1 whitespace-nowrap text-xs text-accent-text underline underline-offset-2 sm:col-start-4"
              >
                history →
              </Link>
            </label>
          );
        })}

        <Button type="submit" variant="primary">
          Start workout
        </Button>
      </form>
      <Note>
        Resuming an unfinished session? It&apos;s the first option in that
        person&apos;s plan list.
      </Note>
    </PageShell>
  );
}
