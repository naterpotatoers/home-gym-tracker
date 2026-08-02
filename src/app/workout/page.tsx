import Link from "next/link";
import { SeedBanner } from "@/components/ui";
import { loadGymData } from "@/lib/db/snapshot";
import { clientSummaries } from "@/lib/queries";

export default async function WorkoutPage() {
  const data = await loadGymData();
  const summaries = clientSummaries(data);

  return (
    <main className="mx-auto w-full max-w-5xl px-6 py-10 font-sans">
      {data.source === "seed" && <SeedBanner />}
      <h1 className="text-3xl font-bold tracking-tight">Start a workout</h1>
      <p className="mt-2 text-sm opacity-70">Who&apos;s training?</p>

      <Link
        href="/workout/group"
        className="mt-4 inline-block rounded-lg border border-current/20 bg-current/10 px-5 py-2 text-sm font-semibold hover:bg-current/20"
      >
        Group session — log everyone from one board
      </Link>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {summaries.map(({ client, sessionCount, lastSessionDate }) => (
          <Link
            key={client.id}
            href={`/workout/${client.id}`}
            className="rounded-lg border border-current/20 p-5 hover:bg-current/5"
          >
            <h2 className="text-lg font-semibold">{client.firstName}</h2>
            <p className="mt-1 text-xs opacity-60">
              {sessionCount} sessions
              {lastSessionDate && ` · last ${lastSessionDate}`}
            </p>
          </Link>
        ))}
      </div>
    </main>
  );
}
