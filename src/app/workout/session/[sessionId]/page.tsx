import { notFound } from "next/navigation";
import { WorkoutRunner } from "@/components/workout-runner";
import { Chip, SeedBanner } from "@/components/ui";
import { clientById } from "@/lib/data/clients";
import { exerciseById } from "@/lib/data/exercises";
import { modalityById } from "@/lib/data/modalities";
import { loadGymData } from "@/lib/db/snapshot";
import { availableVariants, blocksFor, describeSet } from "@/lib/queries";

export default async function SessionPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;
  const data = await loadGymData();
  const session = data.sessionById.get(sessionId);
  if (!session) notFound();

  const client = clientById.get(session.clientId);

  // Completed or skipped: read-only recap.
  if (session.status !== "planned") {
    return (
      <main className="mx-auto w-full max-w-5xl px-6 py-10 font-sans">
        <div className="flex flex-wrap items-baseline gap-3">
          <h1 className="text-2xl font-bold tracking-tight">
            {client?.firstName} — {session.date}
          </h1>
          <Chip>{session.status}</Chip>
          {session.rpe !== null && <Chip>RPE {session.rpe}</Chip>}
          {session.condition && <Chip>felt {session.condition}</Chip>}
          {session.durationMinutes !== null && (
            <span className="text-sm opacity-60">{session.durationMinutes} min</span>
          )}
        </div>
        {session.notes && <p className="mt-2 text-sm opacity-70">{session.notes}</p>}

        <div className="mt-6 space-y-4">
          {blocksFor(data, session.id).map((block, i) => (
            <div key={i}>
              <h2 className="text-sm font-semibold">
                {exerciseById.get(block.exerciseId)?.name}
                <span className="ml-2 rounded bg-current/10 px-1.5 py-0.5 text-xs font-normal">
                  {modalityById.get(block.modalityId)?.name}
                  {block.sets[0].bandRole === "assistance" && " · assisted"}
                </span>
              </h2>
              <ul className="mt-1 space-y-0.5 text-sm opacity-80">
                {block.sets.map((set) => (
                  <li key={set.id} className="font-mono text-xs">
                    {set.setNumber}. {describeSet(data, set)}
                    {!set.completed && " · skipped"}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </main>
    );
  }

  // Planned: the live runner.
  const prescriptions = session.routineId
    ? (data.exercisesByRoutine.get(session.routineId) ?? [])
    : [];

  return (
    <main className="mx-auto w-full max-w-5xl px-6 py-10 font-sans">
      {data.source === "seed" && <SeedBanner />}
      <WorkoutRunner
        session={session}
        initialSets={data.setsBySession.get(session.id) ?? []}
        prescriptions={prescriptions}
        variants={availableVariants()}
        clientName={client?.firstName ?? session.clientId}
      />
    </main>
  );
}
