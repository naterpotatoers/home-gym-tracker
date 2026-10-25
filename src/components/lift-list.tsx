"use client";

import Link from "next/link";
import { useState } from "react";
import { ColorDot, Input } from "@/components/ui";
import { nameKey } from "@/lib/names";

/** One lift in the Progress list — plain data, built on the server. */
export type LiftListRow = {
  key: string;
  href: string;
  name: string;
  gear: string;
  groupColor: string | null;
  /** "220 lb" or "—". */
  best: string;
  arrow: "up" | "down" | null;
  /** "1d ago". */
  lastLabel: string;
  selected: boolean;
  /** Everything search should match: name, aliases, gear, muscle group. */
  search: string[];
};

/**
 * The Progress tab's lift picker: search on top, one compact row per lift
 * (most recent first). Selecting a row swaps the history pane beside it.
 */
export function LiftList({ rows }: { rows: LiftListRow[] }) {
  const [search, setSearch] = useState("");
  const q = nameKey(search);
  const shown = q ? rows.filter((r) => r.search.some((s) => nameKey(s).includes(q))) : rows;

  return (
    <div>
      <Input
        type="search"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search lifts"
        aria-label="Search lifts"
        className="w-full"
      />
      <ul className="mt-2 md:max-h-[calc(100dvh-10rem)] md:overflow-y-auto md:pr-1">
        {shown.map((r) => (
          <li key={r.key}>
            <Link
              href={r.href}
              scroll={false}
              aria-current={r.selected ? "true" : undefined}
              className={`flex min-h-11 items-center gap-2 rounded-md px-2 py-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent/60 ${
                r.selected ? "bg-accent-soft" : "hover:bg-current/5"
              }`}
            >
              <ColorDot color={r.groupColor} />
              <span className="min-w-0 flex-1">
                <span
                  className={`block truncate text-sm ${
                    r.selected ? "font-semibold text-accent-text" : ""
                  }`}
                >
                  {r.name}
                </span>
                <span className="block truncate text-xs text-muted">
                  {r.gear} · {r.lastLabel}
                </span>
              </span>
              <span className="whitespace-nowrap font-mono text-xs">
                {r.best}
                <span
                  className={`ml-0.5 inline-block w-3 text-[10px] ${
                    r.arrow === "up" ? "text-success-text" : "text-danger-text"
                  }`}
                  aria-label={r.arrow ? `trending ${r.arrow}` : undefined}
                >
                  {r.arrow === "up" ? "▲" : r.arrow === "down" ? "▼" : ""}
                </span>
              </span>
            </Link>
          </li>
        ))}
        {shown.length === 0 && <li className="px-2 py-3 text-sm text-muted">No lifts match.</li>}
      </ul>
    </div>
  );
}
