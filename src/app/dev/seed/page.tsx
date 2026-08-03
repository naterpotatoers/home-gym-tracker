import { seedDatabase } from "@/lib/actions/seed";
import { seedSnapshot } from "@/lib/data/seed-snapshot";
import { tableStatuses } from "@/lib/db/status";
import { Button, PageShell, TableScroll, Td, Th } from "@/components/ui";

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
    <PageShell className="max-w-2xl">
      <h1 className="text-2xl font-bold tracking-tight">Database setup</h1>

      <TableScroll>
        <table className="mt-6 w-full text-sm">
          <thead>
            <tr className="border-b border-border-strong text-left">
              <Th>Table</Th>
              <Th numeric>Rows</Th>
              <Th numeric>Seed rows</Th>
            </tr>
          </thead>
          <tbody>
            {statuses.map(({ table, count }) => (
              <tr key={table} className="border-b border-border">
                <Td><span className="font-mono text-xs">{table}</span></Td>
                <Td numeric>{count === null ? "missing" : count}</Td>
                <Td numeric>{expected[table]}</Td>
              </tr>
            ))}
          </tbody>
        </table>
      </TableScroll>

      {migrationMissing ? (
        <p className="mt-6 text-sm leading-relaxed text-muted">
          Tables are missing — run{" "}
          <code className="rounded bg-current/10 px-1 py-0.5 text-xs">
            supabase/migrations/001_init.sql
          </code>{" "}
          in the Supabase SQL editor, then reload this page. Until then the app
          runs read-only from the TypeScript seed data.
        </p>
      ) : allEmpty ? (
        <form action={seedDatabase} className="mt-6">
          <Button type="submit" variant="primary">
            Seed database
          </Button>
          <p className="mt-2 text-xs text-muted">
            Inserts the TypeScript seed data above. One time only — the action
            refuses to touch non-empty tables.
          </p>
        </form>
      ) : (
        <p className="mt-6 text-sm text-muted">
          Database is seeded. The app is reading from Supabase.
        </p>
      )}
    </PageShell>
  );
}
