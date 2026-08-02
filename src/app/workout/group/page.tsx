import { SeedBanner } from "@/components/ui";
import { startGroupFromForm } from "@/lib/actions/group";
import { clients } from "@/lib/data/clients";
import { loadGymData } from "@/lib/db/snapshot";
import { routineForDay } from "@/lib/queries";

/** Group setup: who's training and on what. Each person defaults to their
 *  resumable planned session, else today's program day, else picks a routine. */
export default async function GroupSetupPage() {
  const data = await loadGymData();
  const todayDow = ((new Date().getDay() + 6) % 7) + 1;
  const routines = [...data.routines].sort((a, b) => a.name.localeCompare(b.name));

  const rows = clients.map((client) => {
    const planned = data.sessions.find(
      (s) => s.clientId === client.id && s.status === "planned",
    );
    const assignment = data.assignments.find(
      (a) => a.clientId === client.id && a.status === "active",
    );
    const todaysRoutine = routineForDay(data, client.id, todayDow);
    const defaultPlan = planned
      ? `resume:${planned.id}`
      : todaysRoutine
        ? `${todaysRoutine.routineId}|${assignment?.id ?? ""}`
        : `${routines[0]?.id ?? ""}|`;
    return { client, planned, assignment, todaysRoutine, defaultPlan };
  });

  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-10 font-sans">
      {data.source === "seed" && <SeedBanner />}
      <h1 className="text-3xl font-bold tracking-tight">Group session</h1>
      <p className="mt-2 text-sm opacity-70">
        Everyone trains their own plan; you log it all from one board.
      </p>

      <form action={startGroupFromForm} className="mt-8 space-y-3">
        {rows.map(({ client, planned, assignment, todaysRoutine, defaultPlan }) => (
          <label
            key={client.id}
            className="flex flex-wrap items-center gap-3 rounded-lg border border-current/10 px-4 py-3"
          >
            <input
              type="checkbox"
              name={`include_${client.id}`}
              defaultChecked={planned !== undefined || todaysRoutine !== null}
              className="size-4"
            />
            <span className="w-20 font-semibold">{client.firstName}</span>
            <select
              name={`plan_${client.id}`}
              defaultValue={defaultPlan}
              className="min-w-56 flex-1 rounded border border-current/20 bg-transparent px-2 py-1.5 text-sm"
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
            </select>
          </label>
        ))}

        <button
          type="submit"
          className="rounded border border-current/20 bg-current/10 px-5 py-2 text-sm font-semibold hover:bg-current/20"
        >
          Start group workout
        </button>
      </form>
    </main>
  );
}
