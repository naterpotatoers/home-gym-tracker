import Link from "next/link";
import { SortableTable, type SortableRow } from "@/components/sortable-table";
import type { exerciseHistory } from "@/lib/progress";

export function HistoryTable({
  history,
}: {
  history: ReturnType<typeof exerciseHistory>;
}) {
  const rows: SortableRow[] = history.map((p) => ({
    key: p.sessionId,
    sort: {
      date: p.date,
      top: p.topSet?.weightLbs ?? null,
      e1rm: p.bestE1rmLbs,
      sets: p.setCount,
      volume: p.volumeLbs > 0 ? p.volumeLbs : null,
    },
    cells: {
      date: (
        <Link
          href={`/workout/session/${p.sessionId}`}
          className="font-mono text-xs text-accent-text underline underline-offset-2"
        >
          {p.date}
        </Link>
      ),
      top: p.topSet ? `${Math.round(p.topSet.weightLbs)} × ${p.topSet.reps}` : "—",
      e1rm: p.bestE1rmLbs === null ? "—" : Math.round(p.bestE1rmLbs),
      sets: p.setCount,
      volume: p.volumeLbs > 0 ? Math.round(p.volumeLbs).toLocaleString() : "—",
    },
  }));
  return (
    <div className="mt-6">
      <SortableTable
        columns={[
          { key: "date", label: "Date" },
          { key: "top", label: "Top set", numeric: true },
          { key: "e1rm", label: "e1RM", numeric: true },
          { key: "sets", label: "Sets", numeric: true },
          { key: "volume", label: "Volume", numeric: true },
        ]}
        rows={rows}
        initialSort={{ key: "date", dir: "desc" }}
      />
    </div>
  );
}
