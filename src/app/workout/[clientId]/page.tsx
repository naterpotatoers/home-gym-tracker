import Link from "next/link";
import { notFound } from "next/navigation";
import { Button, PageShell, Section, SeedBanner, TableScroll, Td, Th } from "@/components/ui";
import { startSession } from "@/lib/actions/workout";
import { loadGymData } from "@/lib/db/snapshot";
import { addDaysIso, localTodayIso } from "@/lib/periods";
import { sessionsFor } from "@/lib/queries";

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

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
    const today = localTodayIso();
    const elapsed = Math.floor(
      (new Date(`${today}T00:00:00`).getTime() -
        new Date(`${assignment.startDate}T00:00:00`).getTime()) /
        (7 * 24 * 60 * 60 * 1000),
    );
    currentWeek = Math.min(Math.max(elapsed + 1, 1), program.weeks);
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

  const routines = [...data.routines].sort((a, b) => a.name.localeCompare(b.name));
  const recent = sessionsFor(data, clientId)
    .filter((s) => s.status === "completed")
    .slice(0, 8);

  return (
    <PageShell>
      {data.source === "seed" && <SeedBanner />}
      <h1 className="text-3xl font-bold tracking-tight">{client.firstName}</h1>

      {planned.length > 0 && (
        <Section title="Resume">
          <TableScroll>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border-strong text-left">
                  <Th>Started</Th>
                  <Th>Routine</Th>
                  <Th>{""}</Th>
                </tr>
              </thead>
              <tbody>
                {planned.map((session) => (
                  <tr key={session.id} className="border-b border-border">
                    <Td>
                      <span className="font-mono text-xs">{session.date}</span>
                    </Td>
                    <Td>{data.routineById.get(session.routineId ?? "")?.name ?? "Session"}</Td>
                    <Td>
                      <Link
                        href={`/workout/session/${session.id}`}
                        className="text-accent-text underline underline-offset-2"
                      >
                        Resume →
                      </Link>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableScroll>
        </Section>
      )}

      {assignment && program && (
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
                            <Button type="submit" size="sm">
                              Start
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
        </Section>
      )}

      <Section title="Ad-hoc routine">
        <TableScroll>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border-strong text-left">
                <Th>Routine</Th>
                <Th numeric>Exercises</Th>
                <Th>{""}</Th>
              </tr>
            </thead>
            <tbody>
              {routines.map((routine) => (
                <tr key={routine.id} className="border-b border-border">
                  <Td>{routine.name}</Td>
                  <Td numeric>{data.exercisesByRoutine.get(routine.id)?.length ?? 0}</Td>
                  <Td>
                    <form action={startSession.bind(null, clientId, routine.id, null)}>
                      <Button type="submit" size="sm">
                        Start
                      </Button>
                    </form>
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableScroll>
      </Section>

      {recent.length > 0 && (
        <Section title="Recent sessions">
          <TableScroll>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border-strong text-left">
                  <Th>Date</Th>
                  <Th>Routine</Th>
                  <Th numeric>RPE</Th>
                  <Th>Felt</Th>
                  <Th numeric>Min</Th>
                </tr>
              </thead>
              <tbody>
                {recent.map((session) => (
                  <tr key={session.id} className="border-b border-border">
                    <Td>
                      <Link
                        href={`/workout/session/${session.id}`}
                        className="font-mono text-xs text-accent-text underline underline-offset-2"
                      >
                        {session.date}
                      </Link>
                    </Td>
                    <Td>{data.routineById.get(session.routineId ?? "")?.name ?? "ad-hoc"}</Td>
                    <Td numeric>{session.rpe ?? "—"}</Td>
                    <Td>{session.condition ?? "—"}</Td>
                    <Td numeric>{session.durationMinutes ?? "—"}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableScroll>
        </Section>
      )}
    </PageShell>
  );
}
