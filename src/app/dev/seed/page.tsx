import { seedDatabase } from "@/lib/actions/seed";
import { seedSnapshot } from "@/lib/data/seed-snapshot";
import { tableStatuses } from "@/lib/db/status";

/**
 * Bootstrap tool: shows live row counts per table and offers a one-time seed
 * from the TypeScript data. The action refuses non-empty tables, so leaving
 * this page reachable is safe.
 */
export default async function SeedPage() {
  const statuses = await tableStatuses();
  const seed = seedSnapshot();
  const expected: Record<string, number> = {
    routines: seed.routines.length,
    routine_exercises: seed.routineExercises.length,
    programs: seed.programs.length,
    program_days: seed.programDays.length,
    assignments: seed.assignments.length,
    sessions: seed.sessions.length,
    set_logs: seed.setLogs.length,
    weigh_ins: seed.weighIns.length,
  };

  const migrationMissing = statuses.some((s) => s.count === null);
  const allEmpty = statuses.every((s) => s.count === 0);

  return (
    <main className="mx-auto max-w-2xl px-6 py-10 font-sans">
      <h1 className="text-2xl font-bold tracking-tight">Database setup</h1>

      <table className="mt-6 w-full text-sm">
        <thead>
          <tr className="border-b border-current/20 text-left">
            <th className="py-1.5 pr-3 text-xs font-semibold uppercase tracking-wide opacity-60">
              Table
            </th>
            <th className="py-1.5 pr-3 text-right text-xs font-semibold uppercase tracking-wide opacity-60">
              Rows
            </th>
            <th className="py-1.5 text-right text-xs font-semibold uppercase tracking-wide opacity-60">
              Seed rows
            </th>
          </tr>
        </thead>
        <tbody>
          {statuses.map(({ table, count }) => (
            <tr key={table} className="border-b border-current/10">
              <td className="py-1.5 pr-3 font-mono text-xs">{table}</td>
              <td className="py-1.5 pr-3 text-right font-mono text-xs">
                {count === null ? "missing" : count}
              </td>
              <td className="py-1.5 text-right font-mono text-xs opacity-60">
                {expected[table]}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {migrationMissing ? (
        <p className="mt-6 text-sm leading-relaxed opacity-70">
          Tables are missing — run{" "}
          <code className="rounded bg-current/10 px-1 py-0.5 text-xs">
            supabase/migrations/001_init.sql
          </code>{" "}
          in the Supabase SQL editor, then reload this page. Until then the app
          runs read-only from the TypeScript seed data.
        </p>
      ) : allEmpty ? (
        <form action={seedDatabase} className="mt-6">
          <button
            type="submit"
            className="rounded border border-current/20 px-4 py-2 text-sm font-semibold hover:bg-current/10"
          >
            Seed database
          </button>
          <p className="mt-2 text-xs opacity-60">
            Inserts the TypeScript seed data above. One time only — the action
            refuses to touch non-empty tables.
          </p>
        </form>
      ) : (
        <p className="mt-6 text-sm opacity-70">
          Database is seeded. The app is reading from Supabase.
        </p>
      )}
    </main>
  );
}
