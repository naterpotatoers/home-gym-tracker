import Link from "next/link";
import { GroupBoard, type BoardPerson } from "@/components/group-board";
import { PageShell } from "@/components/ui";
import { loadGymData } from "@/lib/db/snapshot";
import { catalogSlice } from "@/lib/exercise-catalog";
import { availableVariants, recentVariantKeys } from "@/lib/queries";

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
      clientName: data.clientById.get(session!.clientId)?.firstName ?? session!.clientId,
      color: data.clientById.get(session!.clientId)?.color ?? null,
      routineName: data.routineById.get(session!.routineId ?? "")?.name ?? "Session",
      recentKeys: recentVariantKeys(data, session!.clientId),
    }));

  if (people.length === 0) {
    return (
      <PageShell className="max-w-3xl">
        <h1 className="text-2xl font-bold tracking-tight">Group board</h1>
        <p className="mt-3 text-sm text-muted">
          No open sessions here.{" "}
          <Link href="/workout" className="text-accent-text underline underline-offset-2">
            Set up a workout
          </Link>
          .
        </p>
      </PageShell>
    );
  }

  return (
    <PageShell className="max-w-7xl">
      <GroupBoard
        people={people}
        variants={availableVariants(data)}
        catalog={catalogSlice(data)}
      />
    </PageShell>
  );
}
