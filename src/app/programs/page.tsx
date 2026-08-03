import Link from "next/link";
import { Button, Chip, Input, PageShell, Section, SeedBanner } from "@/components/ui";
import { createProgram } from "@/lib/actions/programs";
import { createRoutine } from "@/lib/actions/routines";
import { loadGymData } from "@/lib/db/snapshot";

/** Planning hub: programs (weekly schedules) and the routines they're built
 *  from, one page. Create controls live in each section header. */
export default async function PlanPage() {
  const data = await loadGymData();
  const programs = [...data.programs].sort((a, b) => a.name.localeCompare(b.name));
  const routines = [...data.routines].sort((a, b) => a.name.localeCompare(b.name));

  return (
    <PageShell>
      {data.source === "seed" && <SeedBanner />}
      <h1 className="text-3xl font-bold tracking-tight">Plan</h1>
      <p className="mt-2 text-sm text-muted">
        A routine is one day of training; a program schedules routines across
        the days of each week. Assign a program to someone to drive their
        workouts.
      </p>

      <Section
        title="Programs"
        action={
          <form action={createProgram} className="flex flex-wrap items-center gap-2 pb-1">
            <Input type="text" name="name" required placeholder="New program" size="sm" className="w-44" />
            <Button type="submit" variant="primary" size="sm">
              Create
            </Button>
          </form>
        }
      >
        <ul className="space-y-2">
          {programs.map((program) => {
            const assigned = data.assignments.filter(
              (a) => a.programId === program.id && a.status === "active",
            );
            return (
              <li key={program.id}>
                <Link
                  href={`/programs/${program.id}`}
                  className="flex flex-wrap items-baseline gap-3 rounded-xl border border-border bg-surface px-4 py-3 hover:border-accent/50"
                >
                  <span className="font-semibold">{program.name}</span>
                  <span className="text-xs text-muted">
                    {program.weeks} {program.weeks === 1 ? "week" : "weeks"}
                  </span>
                  {assigned.map((a) => (
                    <Chip key={a.id}>
                      {data.clientById.get(a.clientId)?.firstName ?? a.clientId}
                    </Chip>
                  ))}
                  {program.notes && (
                    <span className="truncate text-xs text-muted">{program.notes}</span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </Section>

      <Section
        title="Routines"
        action={
          <form action={createRoutine} className="flex flex-wrap items-center gap-2 pb-1">
            <Input type="text" name="name" required placeholder="New routine" size="sm" className="w-44" />
            <Button type="submit" variant="primary" size="sm">
              Create
            </Button>
          </form>
        }
      >
        <ul className="space-y-2">
          {routines.map((routine) => {
            const count = data.exercisesByRoutine.get(routine.id)?.length ?? 0;
            return (
              <li key={routine.id}>
                <Link
                  href={`/routines/${routine.id}`}
                  className="flex items-baseline gap-3 rounded-xl border border-border bg-surface px-4 py-3 hover:border-accent/50"
                >
                  <span className="font-semibold">{routine.name}</span>
                  <span className="text-xs text-muted">{count} exercises</span>
                  {routine.notes && (
                    <span className="truncate text-xs text-muted">{routine.notes}</span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </Section>
    </PageShell>
  );
}
