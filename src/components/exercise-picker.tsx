"use client";

import { useMemo, useState } from "react";
import { exerciseById } from "@/lib/data/exercises";
import type { Variant } from "@/lib/queries";
import type { MovementPattern } from "@/lib/types";

const PATTERN_LABELS: Record<MovementPattern, string> = {
  squat: "Squat",
  hinge: "Hinge",
  lunge: "Lunge",
  push_h: "Horizontal Push",
  push_v: "Vertical Push",
  pull_h: "Horizontal Pull",
  pull_v: "Vertical Pull",
  carry: "Carry",
  core: "Core",
  isolation: "Isolation",
  mobility: "Mobility",
};

const PATTERN_ORDER = Object.keys(PATTERN_LABELS) as MovementPattern[];

/**
 * Searchable picker over the performable exercise × modality variants, grouped
 * by movement pattern. Used by the routine editor (add/replace a prescription)
 * and the workout runner (swap an exercise mid-session).
 */
export function ExercisePicker({
  variants,
  onSelect,
  onClose,
  emphasizePattern,
}: {
  variants: Variant[];
  onSelect: (variant: Variant) => void;
  onClose: () => void;
  /** Same-pattern variants sort first — for like-for-like swaps. */
  emphasizePattern?: MovementPattern;
}) {
  const [search, setSearch] = useState("");

  const groups = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = q
      ? variants.filter((v) =>
          `${v.exerciseName} ${v.modalityName}`.toLowerCase().includes(q),
        )
      : variants;

    const byPattern = new Map<MovementPattern, Variant[]>();
    for (const variant of filtered) {
      const pattern =
        exerciseById.get(variant.exerciseModality.exerciseId)?.pattern ?? "isolation";
      const existing = byPattern.get(pattern);
      if (existing) existing.push(variant);
      else byPattern.set(pattern, [variant]);
    }
    const order = emphasizePattern
      ? [emphasizePattern, ...PATTERN_ORDER.filter((p) => p !== emphasizePattern)]
      : PATTERN_ORDER;
    return order
      .filter((p) => byPattern.has(p))
      .map((p) => ({ pattern: p, variants: byPattern.get(p)! }));
  }, [variants, search, emphasizePattern]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-4 pt-16"
      onClick={onClose}
    >
      <div
        className="max-h-[80vh] w-full max-w-lg overflow-y-auto rounded-lg border border-current/20 bg-[var(--color-background)] p-4 font-sans shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3">
          <input
            autoFocus
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search exercises…"
            className="w-full rounded border border-current/20 bg-transparent px-3 py-1.5 text-sm outline-none"
          />
          <button
            type="button"
            onClick={onClose}
            className="text-sm opacity-60 hover:opacity-100"
          >
            Close
          </button>
        </div>

        {groups.map(({ pattern, variants: group }) => (
          <div key={pattern} className="mt-4">
            <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide opacity-60">
              {PATTERN_LABELS[pattern]}
            </h3>
            <ul>
              {group.map((variant) => (
                <li key={`${variant.exerciseModality.exerciseId}-${variant.exerciseModality.modalityId}`}>
                  <button
                    type="button"
                    onClick={() => onSelect(variant)}
                    className="flex w-full items-baseline gap-2 rounded px-2 py-1 text-left text-sm hover:bg-current/10"
                  >
                    <span>{variant.exerciseName}</span>
                    <span className="rounded bg-current/10 px-1.5 py-0.5 text-xs">
                      {variant.modalityName}
                    </span>
                    {!variant.allowsFailure && (
                      <span className="text-xs opacity-50">no fail-safe</span>
                    )}
                    {variant.exerciseModality.isDefault && (
                      <span className="text-xs opacity-40">default</span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ))}
        {groups.length === 0 && (
          <p className="mt-4 text-sm opacity-60">No variants match.</p>
        )}
      </div>
    </div>
  );
}
