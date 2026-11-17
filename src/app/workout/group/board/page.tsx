import Link from "next/link";
import { GroupBoard } from "@/components/group-board";
import { PageShell } from "@/components/ui";
import { loadGymData } from "@/lib/db/snapshot";
import { catalogSlice } from "@/lib/exercise-catalog";
import { availableVariants } from "@/lib/queries";
import { livePerson } from "@/lib/live-session";

export default async function GroupBoardPage({
  searchParams,
}: {
  searchParams: Promise<{ s?: string }>;
}) {
  const { s } = await searchParams;
  const data = await loadGymData();

  // Completed sessions stay on the board: finishing someone revalidates this
  // page, and dropping them would unmount their recap card, change the
  // board's clock key, and make "everyone done" fire early.
  const people = (s ?? "")
    .split(",")
    .flatMap((id) => {
      const session = data.sessionById.get(id);
      return session && (session.status === "planned" || session.status === "completed")
        ? [livePerson(data, session)]
        : [];
    });

  if (people.length === 0) {
    return (
      <PageShell>
        {/* Reading width, left edge still lined up with the nav. */}
        <div className="max-w-3xl">
          <h1 className="text-2xl font-bold tracking-tight">Group board</h1>
          <p className="mt-3 text-sm text-muted">
            No open sessions here.{" "}
            <Link href="/" className="text-accent-text underline underline-offset-2">
              Set up a workout
            </Link>
            .
          </p>
        </div>
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
