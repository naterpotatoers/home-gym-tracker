import Link from "next/link";
import { CopyIcon, PencilIcon, PlusIcon } from "@/components/icons";
import { ModalityChip } from "@/components/modality-chip";
import { Button, Chip, IconButton, Input, PageShell, Section } from "@/components/ui";
import { createProgram, duplicateProgram } from "@/lib/actions/programs";
import { createRoutine, duplicateRoutine } from "@/lib/actions/routines";
import { exerciseById } from "@/lib/data/exercises";
import { loadGymData } from "@/lib/db/snapshot";
import type { RoutineExercise } from "@/lib/types";

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/** "3×10", "3×8–12", or "1×30s" — the high-level scheme, no RIR/rest. */
function schemeLabel(rx: RoutineExercise): string {
  if (rx.durationSeconds !== null) return `${rx.sets}×${rx.durationSeconds}s`;
  if (rx.repMin !== null && rx.repMax !== null && rx.repMin !== rx.repMax) {
    return `${rx.sets}×${rx.repMin}–${rx.repMax}`;
  }
  return `${rx.sets}×${rx.repMax ?? rx.repMin ?? "?"}`;
}

const summaryClass =
  "flex min-h-11 cursor-pointer list-none flex-wrap items-center gap-2 px-4 py-2 hover:bg-current/5 [&::-webkit-details-marker]:hidden";

function Caret() {
  return (
    <>
      <span className="text-[10px] text-muted group-open:hidden">▸</span>
      <span className="hidden text-[10px] text-muted group-open:inline">▾</span>
    </>
  );
}

/**
 * Planning hub: programs (weekly schedules) and the routines they're built
 * from, one page. Rows expand in place to a high-level overview; the pencil
 * opens the full editor. Create controls live in each section header.
 */
export default async function PlanPage() {
  const data = await loadGymData();
  const programs = [...data.programs].sort((a, b) => a.name.localeCompare(b.name));
  const routines = [...data.routines].sort((a, b) => a.name.localeCompare(b.name));

  return (
    <PageShell>
      <h1 className="text-3xl font-bold tracking-tight">Plan</h1>
      <p className="mt-2 text-sm text-muted">
        A routine is one day of training; a program schedules routines across
        the days of each week. Tap a row for a quick look inside; the pencil
        opens the editor.
      </p>

      <Section
        title="Programs"
        action={
          <form action={createProgram} className="flex flex-wrap items-center gap-2 pb-1">
            <Input type="text" name="name" required placeholder="New program" size="sm" className="w-44" />
            <Button type="submit" variant="primary" size="sm">
              <PlusIcon size={16} /> Create
            </Button>
          </form>
        }
      >
        <ul className="space-y-2">
          {programs.map((program) => {
            const assigned = data.assignments.filter(
              (a) => a.programId === program.id && a.status === "active",
            );
            const weeks = Array.from({ length: program.weeks }, (_, i) => i + 1);
            return (
              <li key={program.id}>
                <details className="group rounded-xl border border-border bg-surface">
                  <summary className={summaryClass}>
                    <Caret />
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
                    <span className="ml-auto flex items-center gap-1">
                      <Link
                        href={`/programs/${program.id}`}
                        title="Edit program"
                        aria-label={`Edit ${program.name}`}
                        className="inline-flex size-9 cursor-pointer items-center justify-center rounded-md text-muted hover:bg-current/5 hover:text-foreground"
                      >
                        <PencilIcon />
                      </Link>
                      <form action={duplicateProgram.bind(null, program.id)}>
                        <IconButton
                          type="submit"
                          size="sm"
                          variant="ghost"
                          title="Duplicate program"
                          aria-label={`Duplicate ${program.name}`}
                        >
                          <CopyIcon />
                        </IconButton>
                      </form>
                    </span>
                  </summary>
                  <div className="space-y-1 px-4 pb-3 pl-8 text-sm">
                    {weeks.map((week) => {
                      const days = data.programDays
                        .filter((d) => d.programId === program.id && d.week === week)
                        .sort((a, b) => a.dayOfWeek - b.dayOfWeek);
                      return (
                        <div key={week} className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
                          <span className="w-8 font-mono text-xs text-muted">W{week}</span>
                          {days.length === 0 ? (
                            <span className="text-xs text-muted">rest</span>
                          ) : (
                            days.map((day) => (
                              <span key={day.dayOfWeek} className="whitespace-nowrap">
                                <span className="font-mono text-xs text-muted">
                                  {DAY_LABELS[day.dayOfWeek - 1]}{" "}
                                </span>
                                {data.routineById.get(day.routineId)?.name ?? day.routineId}
                              </span>
                            ))
                          )}
                        </div>
                      );
                    })}
                  </div>
                </details>
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
              <PlusIcon size={16} /> Create
            </Button>
          </form>
        }
      >
        <ul className="space-y-2">
          {routines.map((routine) => {
            const prescriptions = data.exercisesByRoutine.get(routine.id) ?? [];
            return (
              <li key={routine.id}>
                <details className="group rounded-xl border border-border bg-surface">
                  <summary className={summaryClass}>
                    <Caret />
                    <span className="font-semibold">{routine.name}</span>
                    <span className="text-xs text-muted">
                      {prescriptions.length} exercises
                    </span>
                    {routine.notes && (
                      <span className="truncate text-xs text-muted">{routine.notes}</span>
                    )}
                    <span className="ml-auto flex items-center gap-1">
                      <Link
                        href={`/routines/${routine.id}`}
                        title="Edit routine"
                        aria-label={`Edit ${routine.name}`}
                        className="inline-flex size-9 cursor-pointer items-center justify-center rounded-md text-muted hover:bg-current/5 hover:text-foreground"
                      >
                        <PencilIcon />
                      </Link>
                      <form action={duplicateRoutine.bind(null, routine.id)}>
                        <IconButton
                          type="submit"
                          size="sm"
                          variant="ghost"
                          title="Duplicate routine"
                          aria-label={`Duplicate ${routine.name}`}
                        >
                          <CopyIcon />
                        </IconButton>
                      </form>
                    </span>
                  </summary>
                  <div className="space-y-1 px-4 pb-3 pl-8 text-sm">
                    {prescriptions.length === 0 ? (
                      <span className="text-xs text-muted">No exercises yet.</span>
                    ) : (
                      prescriptions.map((rx) => (
                        <div
                          key={`${rx.exerciseId}-${rx.modalityId}-${rx.order}`}
                          className="flex flex-wrap items-center gap-2"
                        >
                          <span className="font-mono text-xs text-muted">
                            {schemeLabel(rx)}
                          </span>
                          <span>{exerciseById.get(rx.exerciseId)?.name ?? rx.exerciseId}</span>
                          <ModalityChip modalityId={rx.modalityId} />
                          {rx.supersetGroup && (
                            <span className="rounded bg-accent-soft px-1.5 py-0.5 text-[10px] font-semibold text-accent-text">
                              superset {rx.supersetGroup}
                            </span>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </details>
              </li>
            );
          })}
        </ul>
      </Section>
    </PageShell>
  );
}
