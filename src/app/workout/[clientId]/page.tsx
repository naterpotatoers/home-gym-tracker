import Link from "next/link";
import { notFound } from "next/navigation";
import { PlayIcon } from "@/components/icons";
import { RecentWorkouts } from "@/components/recent-workouts";
import { Button, Note, PageShell, Section, TableScroll, Td, Th } from "@/components/ui";
import { startSession } from "@/lib/actions/workout";
import { loadGymData } from "@/lib/db/snapshot";
import { addDaysIso, currentProgramWeek, localTodayIso } from "@/lib/periods";

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/**
 * One person's program page: their assigned program's current week front and
 * center, unfinished sessions to resume, and their workout history. Ad-hoc
 * routine starts live on the /workout screen, not here.
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
  const planned = data.sessions.filter(
    (s) => s.clientId === clientId && s.status === "planned",
  );
  const assignment = data.assignments.find(
    (a) => a.clientId === clientId && a.status === "active",
  );
  const program = assignment ? data.programById.get(assignment.programId) : undefined;

  // Which program week is this calendar week?
  let currentWeek = 1;
  let weekDays: { dayOfWeek: number; routineId: string; done: boolean }[] = [];
  if (assignment && program) {
    currentWeek = currentProgramWeek(assignment, program, localTodayIso());
    const weekStart = addDaysIso(assignment.startDate, (currentWeek - 1) * 7);
    const weekEnd = addDaysIso(assignment.startDate, currentWeek * 7);
    weekDays = data.programDays
      .filter((d) => d.programId === program.id && d.week === currentWeek)
      .sort((a, b) => a.dayOfWeek - b.dayOfWeek)
      .map((day) => ({
        dayOfWeek: day.dayOfWeek,
        routineId: day.routineId,
        done: data.sessions.some(
          (s) =>
            s.clientId === clientId &&
            s.status === "completed" &&
            s.routineId === day.routineId &&
            s.date >= weekStart &&
            s.date < weekEnd,
        ),
      }));
  }

  return (
    <PageShell>
      <h1 className="text-3xl font-bold tracking-tight">{client.firstName}</h1>

      {/* The program is the headline of this page. */}
      {assignment && program ? (
        <Section title={`${program.name} — week ${currentWeek} of ${program.weeks}`}>
          {weekDays.length === 0 ? (
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
                  {weekDays.map((day) => (
                    <tr key={day.dayOfWeek} className="border-b border-border">
                      <Td>
                        <span className="font-mono text-xs text-muted">
                          {DAY_LABELS[day.dayOfWeek - 1]}
                        </span>
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
                          <form
                            action={startSession.bind(null, clientId, day.routineId, assignment.id)}
                          >
                            <Button type="submit" variant="primary" size="sm">
                              <PlayIcon size={14} /> Start
                            </Button>
                          </form>
                        )}
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableScroll>
          )}
          <Note>
            {client.firstName} is on {program.name}. Change or reassign programs
            on the{" "}
            <Link href="/programs" className="text-accent-text underline underline-offset-2">
              Plan
            </Link>{" "}
            page.
          </Note>
        </Section>
      ) : (
        <Section title="Program">
          <p className="text-sm text-muted">
            No program assigned. Assign one on the{" "}
            <Link href="/programs" className="text-accent-text underline underline-offset-2">
              Plan
            </Link>{" "}
            page — or start any routine from the{" "}
            <Link href="/workout" className="text-accent-text underline underline-offset-2">
              Workout
            </Link>{" "}
            screen.
          </p>
        </Section>
      )}

      {planned.length > 0 && (
        <Section title="Resume">
          <ul className="divide-y divide-border text-sm">
            {planned.map((session) => (
              <li key={session.id} className="flex min-h-11 items-center gap-3">
                <span className="font-mono text-xs text-muted">{session.date}</span>
                <span className="font-semibold">
                  {data.routineById.get(session.routineId ?? "")?.name ?? "Session"}
                </span>
                <Link
                  href={`/workout/session/${session.id}`}
                  className="ml-auto text-accent-text underline underline-offset-2"
                >
                  Resume →
                </Link>
              </li>
            ))}
          </ul>
        </Section>
      )}

      <RecentWorkouts data={data} client={clientId} />
    </PageShell>
  );
}
