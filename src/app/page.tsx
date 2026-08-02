import Link from "next/link";
import { SeedBanner } from "@/components/ui";
import { clientById } from "@/lib/data/clients";
import { loadGymData } from "@/lib/db/snapshot";
import { routineForDay } from "@/lib/queries";

const FLOWS = [
  {
    href: "/programs",
    title: "Program Builder",
    blurb:
      "Build daily routines, arrange them into weekly programs, and see which muscles a week neglects.",
  },
  {
    href: "/metrics",
    title: "Historical Metrics",
    blurb:
      "Compare PRs across everyone, and ask what weight fits a rep range — or what reps fit a weight.",
  },
  {
    href: "/workout",
    title: "Start a Workout",
    blurb:
      "Run today's program day or any routine. Swap exercises and adjust every set as you go.",
  },
] as const;

export default async function Home() {
  const data = await loadGymData();

  // JS Sunday-first day → the schema's 1 = Monday .. 7 = Sunday.
  const todayDow = ((new Date().getDay() + 6) % 7) + 1;
  const today = data.assignments
    .filter((a) => a.status === "active")
    .map((a) => ({
      clientId: a.clientId,
      prescribed: routineForDay(data, a.clientId, todayDow),
    }))
    .filter((t) => t.prescribed !== null);

  const inProgress = data.sessions.filter((s) => s.status === "planned");

  return (
    <main className="mx-auto w-full max-w-5xl px-6 py-10 font-sans">
      {data.source === "seed" && <SeedBanner />}
      <h1 className="text-3xl font-bold tracking-tight">Home Gym</h1>

      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        {FLOWS.map((flow) => (
          <Link
            key={flow.href}
            href={flow.href}
            className="rounded-lg border border-current/20 p-5 hover:bg-current/5"
          >
            <h2 className="text-lg font-semibold">{flow.title}</h2>
            <p className="mt-2 text-sm leading-relaxed opacity-70">{flow.blurb}</p>
          </Link>
        ))}
      </div>

      {inProgress.length > 0 && (
        <section className="mt-10">
          <h2 className="mb-3 border-b border-current/20 pb-1 text-lg font-semibold">
            In progress
          </h2>
          <ul className="space-y-2 text-sm">
            {inProgress.map((session) => (
              <li key={session.id}>
                <Link
                  href={`/workout/session/${session.id}`}
                  className="underline underline-offset-2"
                >
                  Resume {clientById.get(session.clientId)?.firstName} —{" "}
                  {data.routineById.get(session.routineId ?? "")?.name ?? "session"}{" "}
                  ({session.date})
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mt-10">
        <h2 className="mb-3 border-b border-current/20 pb-1 text-lg font-semibold">
          Today
        </h2>
        {today.length === 0 ? (
          <p className="text-sm opacity-60">
            No program prescribes training today. Rest day — or start an ad-hoc
            routine from{" "}
            <Link href="/workout" className="underline underline-offset-2">
              Start a Workout
            </Link>
            .
          </p>
        ) : (
          <ul className="space-y-2 text-sm">
            {today.map(({ clientId, prescribed }) => (
              <li key={clientId} className="flex items-baseline gap-3">
                <span className="font-semibold">
                  {clientById.get(clientId)?.firstName}
                </span>
                <span className="opacity-70">
                  {data.routineById.get(prescribed!.routineId)?.name} ·{" "}
                  {prescribed!.exercises.length} exercises
                </span>
                <Link
                  href={`/workout/${clientId}`}
                  className="underline underline-offset-2"
                >
                  Start
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
