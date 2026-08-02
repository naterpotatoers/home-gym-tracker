import Link from "next/link";
import { Button, Chip, Input, PageShell, SeedBanner } from "@/components/ui";
import { createProgram } from "@/lib/actions/programs";
import { clientById } from "@/lib/data/clients";
import { loadGymData } from "@/lib/db/snapshot";

export default async function ProgramsPage() {
  const data = await loadGymData();
  const programs = [...data.programs].sort((a, b) => a.name.localeCompare(b.name));

  return (
    <PageShell>
      {data.source === "seed" && <SeedBanner />}
      <h1 className="text-3xl font-bold tracking-tight">Programs</h1>
      <p className="mt-2 text-sm opacity-70">
        A program schedules routines across the days of each week. Assign one to
        a client to drive their workouts. Daily routines live in{" "}
        <Link href="/routines" className="underline underline-offset-2">
          Routines
        </Link>
        .
      </p>

      <ul className="mt-8 space-y-2">
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
                <span className="text-xs opacity-60">{program.weeks} weeks</span>
                {assigned.map((a) => (
                  <Chip key={a.id}>
                    {clientById.get(a.clientId)?.firstName ?? a.clientId}
                  </Chip>
                ))}
                {program.notes && (
                  <span className="truncate text-xs opacity-50">{program.notes}</span>
                )}
              </Link>
            </li>
          );
        })}
      </ul>

      <form action={createProgram} className="mt-8 flex flex-wrap gap-2">
        <Input type="text" name="name" required placeholder="New program name" />
        <Input
          type="number"
          name="weeks"
          required
          min={1}
          max={52}
          defaultValue={8}
          align="right"
          className="w-20"
        />
        <Button type="submit" variant="primary">
          Create
        </Button>
      </form>
    </PageShell>
  );
}
