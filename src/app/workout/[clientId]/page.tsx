import Link from "next/link";
import { notFound } from "next/navigation";
import { Note, PageShell, Section, TableScroll, Td, Th } from "@/components/ui";
import { loadGymData } from "@/lib/db/snapshot";
import { DAY_LABELS, localTodayIso } from "@/lib/periods";
import { programWeekStatus } from "@/lib/planning";

const linkClass = "text-accent-text underline underline-offset-2";

/**
 * One person's program week, read-only: what's scheduled, what's done, and
 * today highlighted. Starting anything happens on the Workout tab — this page
 * deliberately has no Start buttons so there's one way in.
 */
export default async function ClientWorkoutPage({
  params,
}: {
  params: Promise<{ clientId: string }>;
}) {
  const { clientId } = await params;
  const data = await loadGymData();
  const client = data.clientById.get(clientId);
  if (!client) notFound();
  const today = localTodayIso();
  const status = programWeekStatus(data, clientId, today);

  return (
    <PageShell>
      <h1 className="text-3xl font-bold tracking-tight">{client.firstName}</h1>
      <p className="mt-1 text-sm">
        <Link href="/" className={linkClass}>
          Start today from the Workout tab →
        </Link>
      </p>

      {!status ? (
        <Section title="Program">
          <p className="text-sm text-muted">
            No program assigned. Assign one on the{" "}
            <Link href="/programs" className={linkClass}>
              Plan
            </Link>{" "}
            tab — or start any routine from the{" "}
            <Link href="/" className={linkClass}>
              Workout
            </Link>{" "}
            tab.
          </p>
        </Section>
      ) : status.finished ? (
        <Section title={`${status.program.name} — finished`}>
          <p className="text-sm text-muted">
            All {status.program.weeks} weeks are behind {client.firstName}.{" "}
            <Link href={`/programs/${status.program.id}`} className={linkClass}>
              Mark it completed or assign the next program
            </Link>
            .
          </p>
        </Section>
      ) : (
        <Section
          title={`${status.program.name} — week ${status.week} of ${status.program.weeks}`}
        >
          {status.days.length === 0 ? (
            <p className="text-sm text-muted">Nothing scheduled this week.</p>
          ) : (
            <TableScroll>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border-strong text-left">
                    <Th>Day</Th>
                    <Th>Routine</Th>
                    <Th>Status</Th>
                  </tr>
                </thead>
                <tbody>
                  {status.days.map((day) => (
                    <tr
                      key={day.date}
                      className={`border-b border-border ${day.isToday ? "bg-accent-soft" : ""}`}
                    >
                      <Td>
                        <span className="font-mono text-xs text-muted">
                          {DAY_LABELS[day.dayOfWeek - 1]}
                        </span>
                        {day.isToday && (
                          <span className="ml-2 text-xs font-semibold text-accent-text">
                            today
                          </span>
                        )}
                      </Td>
                      <Td>
                        <span
                          className={day.done ? "text-muted line-through" : "font-semibold"}
                        >
                          {data.routineById.get(day.routineId)?.name ?? day.routineId}
                        </span>
                      </Td>
                      <Td>
                        {day.done ? (
                          <span className="text-xs text-success-text">✓ done</span>
                        ) : (
                          <span className="text-xs text-muted">
                            {day.date < today ? "missed" : "to do"}
                          </span>
                        )}
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableScroll>
          )}
          <Note>
            Change or reassign {client.firstName}&apos;s program on{" "}
            <Link href={`/programs/${status.program.id}`} className={linkClass}>
              {status.program.name}
            </Link>
            .
          </Note>
        </Section>
      )}
    </PageShell>
  );
}
