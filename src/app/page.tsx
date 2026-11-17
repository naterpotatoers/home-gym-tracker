import Link from "next/link";
import { PlayIcon } from "@/components/icons";
import { Chip, PageShell } from "@/components/ui";
import { WorkoutLauncher } from "@/components/workout-launcher";
import { launcherRows } from "@/lib/launcher";
import { loadGymData } from "@/lib/db/snapshot";
import { localDayLabel, localTodayIso, todayDow } from "@/lib/periods";
import { openBoardGroups } from "@/lib/queries";

/**
 * Home IS the workout launcher: tap who's training, confirm each person's
 * plan, one Start. One person = solo runner; more = the shared group board.
 * Anyone with an unfinished session or a program day today starts checked.
 */
export default async function Home() {
  const data = await loadGymData();
  const dow = todayDow();
  const today = localTodayIso();
  const boardGroups = openBoardGroups(data);
  const rows = launcherRows(data, today, dow);

  return (
    <PageShell>
      {/* Reading width, left edge still lined up with the nav. */}
      <div className="max-w-3xl">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h1 className="text-3xl font-bold tracking-tight">Today</h1>
          <span className="text-sm text-muted">{localDayLabel(today)}</span>
        </div>

        {boardGroups.length > 0 && (
          <ul className="mt-6 space-y-2">
            {boardGroups.map(({ date, sessionIds }) => (
              <li key={date}>
                <Link
                  href={`/workout/group/board?s=${sessionIds.join(",")}`}
                  className="flex min-h-11 flex-wrap items-center gap-2 rounded-xl border border-accent/50 bg-accent-soft px-4 py-3 text-sm hover:bg-accent/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
                >
                  <PlayIcon size={16} />
                  <span className="font-semibold text-accent-text">Resume group board</span>
                  <span className="font-mono text-xs text-muted">{date}</span>
                  {sessionIds.map((id) => {
                    const client = data.clientById.get(data.sessionById.get(id)?.clientId ?? "");
                    return client ? <Chip key={id}>{client.firstName}</Chip> : null;
                  })}
                </Link>
              </li>
            ))}
          </ul>
        )}

        {rows.length === 0 ? (
          <p className="mt-6 text-sm text-muted">
            No clients yet — add the first one at{" "}
            <Link href="/users" className="text-accent-text underline underline-offset-2">
              Clients
            </Link>
            .
          </p>
        ) : (
          <WorkoutLauncher rows={rows} />
        )}
      </div>
    </PageShell>
  );
}
