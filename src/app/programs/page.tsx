import Link from "next/link";
import { PlusIcon } from "@/components/icons";
import { Button, Chip, Input, PageShell, Section } from "@/components/ui";
import { createProgram } from "@/lib/actions/programs";
import { createRoutine, importCareRoutines } from "@/lib/actions/routines";
import { careRoutines } from "@/lib/data/care-routines";
import { loadGymData } from "@/lib/db/snapshot";
import { DAY_LABELS } from "@/lib/periods";

/** One list per section: a single bordered card, one link row per item —
 *  everything on one line at md+, the summary drops below on phones. */
const listClass = "divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface";
const rowClass =
  "flex min-h-11 flex-wrap items-center gap-x-2 gap-y-0.5 px-4 py-2 hover:bg-current/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent/60 md:flex-nowrap";
const summaryClass = "w-full truncate text-xs text-muted md:w-auto md:min-w-0 md:flex-1";

/**
 * Planning hub: programs (weekly schedules) and the routines they're built
 * from. Each row is one link to its editor with a one-line summary; create
 * controls live in each section header, duplicate/delete in the editors.
 */
export default async function PlanPage() {
  const data = await loadGymData();
  const programs = [...data.programs].sort((a, b) => a.name.localeCompare(b.name));
  const routines = [...data.routines].sort((a, b) => a.name.localeCompare(b.name));
  const careMissing =
    data.source === "database" &&
    careRoutines.some((r) => !data.routineById.has(r.id));

  return (
    <PageShell>
      <h1 className="text-3xl font-bold tracking-tight">Plan</h1>

      <Section
        title="Programs"
        action={
          <form action={createProgram} className="flex flex-wrap items-center gap-2 pb-1">
            <Input type="text" name="name" required placeholder="Name" aria-label="New program name" size="sm" className="w-40" />
            <Button type="submit" variant="primary" size="sm">
              <PlusIcon size={16} /> New program
            </Button>
          </form>
        }
      >
        <ul className={listClass}>
          {programs.map((program) => {
            const assigned = data.assignments.filter(
              (a) => a.programId === program.id && a.status === "active",
            );
            // Week 1 stands in for the shape of the whole program.
            const schedule = data.programDays
              .filter((d) => d.programId === program.id && d.week === 1)
              .sort((a, b) => a.dayOfWeek - b.dayOfWeek)
              .map(
                (d) =>
                  `${DAY_LABELS[d.dayOfWeek - 1]} ${data.routineById.get(d.routineId)?.name ?? d.routineId}`,
              )
              .join(" · ");
            return (
              <li key={program.id}>
                <Link href={`/programs/${program.id}`} className={rowClass}>
                  <span className="shrink-0 font-semibold">{program.name}</span>
                  <span className="shrink-0 text-xs text-muted">
                    {program.weeks} {program.weeks === 1 ? "week" : "weeks"}
                  </span>
                  {assigned.map((a) => (
                    <Chip key={a.id}>
                      {data.clientById.get(a.clientId)?.firstName ?? a.clientId}
                    </Chip>
                  ))}
                  <span className={summaryClass}>{schedule || "Nothing scheduled yet"}</span>
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
            <Input type="text" name="name" required placeholder="Name" aria-label="New routine name" size="sm" className="w-40" />
            <Button type="submit" variant="primary" size="sm">
              <PlusIcon size={16} /> New routine
            </Button>
          </form>
        }
      >
        {careMissing && (
          <div className="mb-3 flex flex-wrap items-center gap-3 rounded-xl border border-border bg-surface px-3 py-2.5">
            <p className="min-w-56 flex-1 text-sm text-muted">
              Six pre-built <span className="font-semibold text-foreground">Care routines</span>{" "}
              (low back, knee, shoulder, hips, posture, ankle/achilles) built
              from the PT evidence review. Add-only — never touches existing
              routines.
            </p>
            <form action={importCareRoutines}>
              <Button type="submit" size="sm">Import care routines</Button>
            </form>
          </div>
        )}
        <ul className={listClass}>
          {routines.map((routine) => {
            const prescriptions = data.exercisesByRoutine.get(routine.id) ?? [];
            const names = prescriptions
              .map((rx) => data.exerciseById.get(rx.exerciseId)?.name ?? rx.exerciseId)
              .join(", ");
            return (
              <li key={routine.id}>
                <Link href={`/routines/${routine.id}`} className={rowClass}>
                  <span className="shrink-0 font-semibold">{routine.name}</span>
                  <span className="shrink-0 text-xs text-muted">
                    {prescriptions.length}{" "}
                    {prescriptions.length === 1 ? "exercise" : "exercises"}
                  </span>
                  <span className={summaryClass}>{names || "No exercises yet"}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </Section>
    </PageShell>
  );
}
