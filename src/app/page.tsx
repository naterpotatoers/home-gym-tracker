import Link from "next/link";
import { Note, PageShell, SeedBanner, Stat } from "@/components/ui";
import { bars, dumbbells } from "@/lib/data/equipment";
import { modalities } from "@/lib/data/modalities";
import { loadGymData } from "@/lib/db/snapshot";
import { todayDow } from "@/lib/periods";
import { loadableWeights, smallestIncrement } from "@/lib/loading";
import { availableVariants, hipBandLadder, routineForDay } from "@/lib/queries";

const FLOWS = [
  {
    href: "/programs",
    title: "Plan",
    blurb:
      "Build daily routines, arrange them into weekly programs, and see which muscles a week neglects.",
  },
  {
    href: "/metrics",
    title: "Progress",
    blurb:
      "Pick a person and a lift — history, PRs, trends, and whether the number is actually going up.",
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

  const dow = todayDow();
  const today = data.assignments
    .filter((a) => a.status === "active")
    .map((a) => ({
      clientId: a.clientId,
      prescribed: routineForDay(data, a.clientId, dow),
    }))
    .filter((t) => t.prescribed !== null);

  const inProgress = data.sessions.filter((s) => s.status === "planned");

  const ohioLoads = loadableWeights("ohio_bar");
  const ownedModalities = modalities.filter((m) => m.owned);

  return (
    <PageShell>
      {data.source === "seed" && <SeedBanner />}
      <h1 className="text-3xl font-bold tracking-tight">Home Gym</h1>

      {/* At a glance — the garage in five numbers, and how progress is scored. */}
      <dl className="mt-4 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2 lg:grid-cols-3">
        <Stat
          label="Exercise variants"
          value={`${availableVariants().length} across ${ownedModalities.length} modalities`}
        />
        <Stat
          label="Barbell"
          value={`${bars.map((b) => b.name).join(" · ")} — ${ohioLoads[0]}–${ohioLoads.at(-1)} lb in ${smallestIncrement("ohio_bar")} lb steps`}
        />
        <Stat
          label="Dumbbells"
          value={`${dumbbells.map((d) => d.weightLbs).join(", ")} lb`}
        />
        <Stat
          label="Hip bands (easy → hard)"
          value={hipBandLadder()
            .map(({ band }) => band.label)
            .join(" → ")}
        />
        <Stat label="People" value={`${data.clients.length} training`} />
      </dl>
      <Note>
        Strength is scored as estimated 1RM (Epley) over completed working sets
        — warmups never count. Muscle volume is score-weighted: every set
        credits each muscle by how directly it trains it. Hip-band work is
        tracked honestly as band rank + reps, never converted to pounds.
      </Note>

      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        {FLOWS.map((flow) => (
          <Link
            key={flow.href}
            href={flow.href}
            className="rounded-xl border border-border bg-surface p-5 hover:border-accent/50"
          >
            <h2 className="text-lg font-semibold">{flow.title}</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted">{flow.blurb}</p>
          </Link>
        ))}
      </div>

      {inProgress.length > 0 && (
        <section className="mt-10">
          <h2 className="mb-3 border-b border-border pb-1 text-lg font-semibold">
            In progress
          </h2>
          <ul className="space-y-2 text-sm">
            {inProgress.map((session) => (
              <li key={session.id}>
                <Link
                  href={`/workout/session/${session.id}`}
                  className="text-accent-text underline underline-offset-2"
                >
                  Resume {data.clientById.get(session.clientId)?.firstName} —{" "}
                  {data.routineById.get(session.routineId ?? "")?.name ?? "session"}{" "}
                  ({session.date})
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mt-10">
        <h2 className="mb-3 border-b border-border pb-1 text-lg font-semibold">
          Today
        </h2>
        {today.length === 0 ? (
          <p className="text-sm text-muted">
            No program prescribes training today. Rest day — or start an ad-hoc
            routine from{" "}
            <Link href="/workout" className="text-accent-text underline underline-offset-2">
              Start a Workout
            </Link>
            .
          </p>
        ) : (
          <ul className="space-y-2 text-sm">
            {today.map(({ clientId, prescribed }) => (
              <li key={clientId} className="flex items-baseline gap-3">
                <span className="font-semibold">
                  {data.clientById.get(clientId)?.firstName}
                </span>
                <span className="opacity-70">
                  {data.routineById.get(prescribed!.routineId)?.name} ·{" "}
                  {prescribed!.exercises.length} exercises
                </span>
                <Link
                  href={`/workout/${clientId}`}
                  className="text-accent-text underline underline-offset-2"
                >
                  Start
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </PageShell>
  );
}
