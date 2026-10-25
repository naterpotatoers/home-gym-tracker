"use client";

import Link from "next/link";
import { useState } from "react";
import { SortableTable, type SortableRow } from "@/components/sortable-table";
import { ColorDot, Input, Select } from "@/components/ui";
import { nameKey } from "@/lib/names";

/** One catalog row — plain data, built on the server. */
export type ExerciseTableRow = {
  id: string;
  name: string;
  aliases: readonly string[];
  pattern: string;
  patternLabel: string;
  /** Position in PATTERN_ORDER — sorts patterns by movement, not A–Z. */
  patternOrder: number;
  /** Variant modality names; empty = not pickable in a routine yet. */
  gear: string[];
  primaryMuscle: string | null;
  groupColor: string | null;
};

/**
 * The Library: every exercise as one dense, sortable row with a name/alias
 * search and a pattern filter. Tapping a row opens its editor.
 */
export function ExerciseTable({
  rows,
  patterns,
}: {
  rows: ExerciseTableRow[];
  patterns: { id: string; label: string }[];
}) {
  const [search, setSearch] = useState("");
  const [pattern, setPattern] = useState("");
  const q = nameKey(search);
  const shown = rows.filter(
    (r) =>
      (!pattern || r.pattern === pattern) &&
      (!q || [r.name, ...r.aliases].some((n) => nameKey(n).includes(q))),
  );

  const tableRows: SortableRow[] = shown.map((r) => {
    const href = `/exercises?exercise=${r.id}`;
    return {
      key: r.id,
      href,
      sort: {
        name: r.name,
        pattern: r.patternOrder,
        gear: r.gear.length,
        primary: r.primaryMuscle,
      },
      cells: {
        name: (
          <span className="inline-flex items-center gap-2">
            <ColorDot color={r.groupColor} />
            <Link
              href={href}
              className="inline-flex min-h-9 items-center rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 pointer-coarse:min-h-11"
            >
              {r.name}
            </Link>
          </span>
        ),
        pattern: <span className="text-xs text-muted">{r.patternLabel}</span>,
        gear: (
          <span className="text-xs text-muted">
            {r.gear.length > 0 ? r.gear.join(" · ") : "—"}
          </span>
        ),
        primary: <span className="text-xs text-muted">{r.primaryMuscle ?? "—"}</span>,
      },
    };
  });

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <Input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search"
          aria-label="Search exercises"
          className="min-w-0 flex-1 sm:max-w-xs"
        />
        <Select
          value={pattern}
          onChange={(e) => setPattern(e.target.value)}
          aria-label="Pattern"
        >
          <option value="">All patterns</option>
          {patterns.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
            </option>
          ))}
        </Select>
        <span className="text-xs text-muted">
          {shown.length} {shown.length === 1 ? "exercise" : "exercises"}
        </span>
      </div>

      {shown.length === 0 ? (
        <p className="mt-4 text-sm text-muted">No exercises match.</p>
      ) : (
        <div className="mt-3">
          <SortableTable
            dense
            columns={[
              { key: "name", label: "Exercise" },
              // Phones keep name + gear; the pattern filter covers the rest.
              { key: "pattern", label: "Pattern", className: "hidden sm:table-cell" },
              { key: "gear", label: "Gear" },
              { key: "primary", label: "Primary", className: "hidden sm:table-cell" },
            ]}
            rows={tableRows}
          />
        </div>
      )}
    </>
  );
}
