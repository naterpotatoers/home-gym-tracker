"use client";

import React, { useMemo, useState } from "react";
import { TableScroll } from "@/components/ui";

export type SortableColumn = {
  key: string;
  label: string;
  numeric?: boolean;
};

export type SortableRow = {
  key: string;
  /** Plain values the client sorts on, per column key; null sorts last. */
  sort: Record<string, string | number | null>;
  /** Server-rendered cells, same column keys. */
  cells: Record<string, React.ReactNode>;
};

type SortState = { key: string; dir: "asc" | "desc" } | null;

/**
 * Click-to-sort table: headers cycle ▲ asc → ▼ desc → unsorted (input order),
 * AG-Grid style, entirely client-side — the cells arrive pre-rendered from
 * the server, only the plain `sort` values are compared here. Wraps itself
 * in the standard mobile overflow scroller.
 */
export function SortableTable({
  columns,
  rows,
  initialSort = null,
  expandedKey,
  expansion,
}: {
  columns: SortableColumn[];
  rows: SortableRow[];
  initialSort?: SortState;
  /** Key of the row whose accordion detail is open — the `expansion` node
   *  renders in a full-width row right below it, following it through sorts. */
  expandedKey?: string;
  expansion?: React.ReactNode;
}) {
  const [sort, setSort] = useState<SortState>(initialSort);

  const sorted = useMemo(() => {
    if (!sort) return rows;
    const { key, dir } = sort;
    const sign = dir === "asc" ? 1 : -1;
    return [...rows].sort((a, b) => {
      const av = a.sort[key];
      const bv = b.sort[key];
      if (av === null || av === undefined) return 1; // nulls last, both dirs
      if (bv === null || bv === undefined) return -1;
      if (typeof av === "string" || typeof bv === "string") {
        return sign * String(av).localeCompare(String(bv));
      }
      return sign * (av - bv);
    });
  }, [rows, sort]);

  function cycle(key: string) {
    setSort((prev) => {
      if (prev?.key !== key) return { key, dir: "asc" };
      if (prev.dir === "asc") return { key, dir: "desc" };
      return null;
    });
  }

  return (
    <TableScroll>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border-strong text-left">
            {columns.map((col) => {
              const active = sort?.key === col.key;
              return (
                <th
                  key={col.key}
                  aria-sort={
                    active ? (sort!.dir === "asc" ? "ascending" : "descending") : "none"
                  }
                  className="p-0"
                >
                  <button
                    type="button"
                    onClick={() => cycle(col.key)}
                    className={`flex min-h-10 w-full cursor-pointer items-center gap-1 py-1 pr-3 text-xs font-semibold uppercase tracking-wide hover:text-foreground ${
                      col.numeric ? "justify-end text-right" : ""
                    } ${active ? "text-accent-text" : "text-muted"}`}
                  >
                    {col.label}
                    <span className={active ? "" : "opacity-40"}>
                      {active ? (sort!.dir === "asc" ? "▲" : "▼") : "↕"}
                    </span>
                  </button>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {sorted.map((row) => (
            <React.Fragment key={row.key}>
              <tr className="border-b border-border">
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className={`py-2 pr-3 ${col.numeric ? "text-right font-mono text-xs" : ""}`}
                  >
                    {row.cells[col.key]}
                  </td>
                ))}
              </tr>
              {expansion !== undefined && row.key === expandedKey && (
                <tr className="border-b border-border">
                  <td colSpan={columns.length} className="p-0">
                    {expansion}
                  </td>
                </tr>
              )}
            </React.Fragment>
          ))}
        </tbody>
      </table>
    </TableScroll>
  );
}
