import Link from "next/link";
import { SeedBanner } from "@/components/ui";
import { createRoutine } from "@/lib/actions/routines";
import { loadGymData } from "@/lib/db/snapshot";

export default async function RoutinesPage() {
  const data = await loadGymData();
  const routines = [...data.routines].sort((a, b) => a.name.localeCompare(b.name));

  return (
    <main className="mx-auto w-full max-w-5xl px-6 py-10 font-sans">
      {data.source === "seed" && <SeedBanner />}
      <h1 className="text-3xl font-bold tracking-tight">Routines</h1>
      <p className="mt-2 text-sm opacity-70">
        A routine is one day of training — exercises, sets, and rep targets.
        Programs schedule routines across a week.
      </p>

      <ul className="mt-8 space-y-2">
        {routines.map((routine) => {
          const count = data.exercisesByRoutine.get(routine.id)?.length ?? 0;
          return (
            <li key={routine.id}>
              <Link
                href={`/routines/${routine.id}`}
                className="flex items-baseline gap-3 rounded-lg border border-current/10 px-4 py-3 hover:bg-current/5"
              >
                <span className="font-semibold">{routine.name}</span>
                <span className="text-xs opacity-60">{count} exercises</span>
                {routine.notes && (
                  <span className="truncate text-xs opacity-50">{routine.notes}</span>
                )}
              </Link>
            </li>
          );
        })}
      </ul>

      <form action={createRoutine} className="mt-8 flex gap-2">
        <input
          type="text"
          name="name"
          required
          placeholder="New routine name"
          className="rounded border border-current/20 bg-transparent px-3 py-1.5 text-sm outline-none"
        />
        <button
          type="submit"
          className="rounded border border-current/20 px-4 py-1.5 text-sm font-semibold hover:bg-current/10"
        >
          Create
        </button>
      </form>
    </main>
  );
}
