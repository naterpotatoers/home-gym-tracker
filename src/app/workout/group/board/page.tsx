import Link from "next/link";
import { GroupBoard, type BoardPerson } from "@/components/group-board";
import { PageShell, SeedBanner } from "@/components/ui";
import { clientById } from "@/lib/data/clients";
import { loadGymData } from "@/lib/db/snapshot";
import { availableVariants } from "@/lib/queries";

export default async function GroupBoardPage({
  searchParams,
}: {
  searchParams: Promise<{ s?: string }>;
}) {
  const { s } = await searchParams;
  const data = await loadGymData();

  const people: BoardPerson[] = (s ?? "")
    .split(",")
    .filter(Boolean)
    .map((id) => data.sessionById.get(id))
    .filter((session) => session !== undefined && session.status === "planned")
    .map((session) => ({
      session: session!,
      initialSets: data.setsBySession.get(session!.id) ?? [],
      prescriptions: session!.routineId
        ? (data.exercisesByRoutine.get(session!.routineId) ?? [])
        : [],
      clientName: clientById.get(session!.clientId)?.firstName ?? session!.clientId,
      routineName: data.routineById.get(session!.routineId ?? "")?.name ?? "Session",
    }));

  if (people.length === 0) {
    return (
      <PageShell className="max-w-3xl">
        <h1 className="text-2xl font-bold tracking-tight">Group board</h1>
        <p className="mt-3 text-sm opacity-70">
          No open sessions here.{" "}
          <Link href="/workout/group" className="underline underline-offset-2">
            Set up a group workout
          </Link>
          .
        </p>
      </PageShell>
    );
  }

  return (
    <PageShell className="max-w-7xl">
      {data.source === "seed" && <SeedBanner />}
      <GroupBoard people={people} variants={availableVariants()} />
    </PageShell>
  );
}
