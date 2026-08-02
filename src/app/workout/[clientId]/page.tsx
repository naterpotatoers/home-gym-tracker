import Link from "next/link";
import { notFound } from "next/navigation";
import { Chip, Section, SeedBanner } from "@/components/ui";
import { startSession } from "@/lib/actions/workout";
import { clientById } from "@/lib/data/clients";
import { loadGymData } from "@/lib/db/snapshot";
import { sessionsFor } from "@/lib/queries";
import { isClientId } from "@/lib/validate";

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function addDays(iso: string, days: number): string {
  const date = new Date(`${iso}T00:00:00`);
  date.setDate(date.getDate() + days);
  return date.toLocaleDateString("en-CA");
}

export default async function ClientWorkoutPage({
  params,
}: {
  params: Promise<{ clientId: string }>;
}) {
  const { clientId } = await params;
  if (!isClientId(clientId)) notFound();
  const client = clientById.get(clientId);
  if (!client) notFound();

  const data = await loadGymData();
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
    const today = new Date().toLocaleDateString("en-CA");
    const elapsed = Math.floor(
      (new Date(`${today}T00:00:00`).getTime() -
        new Date(`${assignment.startDate}T00:00:00`).getTime()) /
        (7 * 24 * 60 * 60 * 1000),
    );
    currentWeek = Math.min(Math.max(elapsed + 1, 1), program.weeks);
    const weekStart = addDays(assignment.startDate, (currentWeek - 1) * 7);
    const weekEnd = addDays(assignment.startDate, currentWeek * 7);
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
    <main className="mx-auto w-full max-w-5xl px-6 py-10 font-sans">
      {data.source === "seed" && <SeedBanner />}
      <h1 className="text-3xl font-bold tracking-tight">{client.firstName}</h1>

      {planned.length > 0 && (
        <Section title="Resume">
          <ul className="space-y-2 text-sm">
            {planned.map((session) => (
              <li key={session.id}>
                <Link
                  href={`/workout/session/${session.id}`}
                  className="underline underline-offset-2"
                >
                  {data.routineById.get(session.routineId ?? "")?.name ?? "Session"} —
                  started {session.date}
                </Link>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {assignment && program && (
        <Section title={`${program.name} — week ${currentWeek} of ${program.weeks}`}>
          {weekDays.length === 0 ? (
            <p className="text-sm opacity-60">Nothing scheduled this week.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {weekDays.map((day) => (
                <li key={day.dayOfWeek} className="flex items-baseline gap-3">
                  <span className="w-10 font-mono text-xs opacity-60">
                    {DAY_LABELS[day.dayOfWeek - 1]}
                  </span>
                  <span className={day.done ? "line-through opacity-50" : "font-semibold"}>
                    {data.routineById.get(day.routineId)?.name ?? day.routineId}
                  </span>
                  {day.done ? (
                    <span className="text-xs opacity-50">done</span>
                  ) : (
                    <form
                      action={startSession.bind(null, clientId, day.routineId, assignment.id)}
                    >
                      <button
                        type="submit"
                        className="rounded border border-current/20 px-2 py-0.5 text-xs font-semibold hover:bg-current/10"
                      >
                        Start
                      </button>
                    </form>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Section>
      )}

      <Section title="Ad-hoc routine">
        <ul className="space-y-2 text-sm">
          {routines.map((routine) => (
            <li key={routine.id} className="flex items-baseline gap-3">
              <span>{routine.name}</span>
              <span className="text-xs opacity-50">
                {data.exercisesByRoutine.get(routine.id)?.length ?? 0} exercises
              </span>
              <form action={startSession.bind(null, clientId, routine.id, null)}>
                <button
                  type="submit"
                  className="rounded border border-current/20 px-2 py-0.5 text-xs font-semibold hover:bg-current/10"
                >
                  Start
                </button>
              </form>
            </li>
          ))}
        </ul>
      </Section>

      {recent.length > 0 && (
        <Section title="Recent sessions">
          <ul className="space-y-2 text-sm">
            {recent.map((session) => (
              <li key={session.id} className="flex flex-wrap items-baseline gap-2">
                <Link
                  href={`/workout/session/${session.id}`}
                  className="font-mono text-xs underline underline-offset-2"
                >
                  {session.date}
                </Link>
                <span className="opacity-70">
                  {data.routineById.get(session.routineId ?? "")?.name ?? "ad-hoc"}
                </span>
                {session.rpe !== null && <Chip>RPE {session.rpe}</Chip>}
                {session.condition && <Chip>felt {session.condition}</Chip>}
                {session.durationMinutes !== null && (
                  <span className="text-xs opacity-50">{session.durationMinutes} min</span>
                )}
              </li>
            ))}
          </ul>
        </Section>
      )}
    </main>
  );
}
