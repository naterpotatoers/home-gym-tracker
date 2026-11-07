"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { ModalityChip } from "@/components/modality-chip";
import { Button, Input } from "@/components/ui";
import { PATTERN_LABELS, PATTERN_ORDER } from "@/lib/exercise-catalog";
import type { Variant } from "@/lib/queries";
import type { SwapSuggestion } from "@/lib/similar";
import type { MovementPattern } from "@/lib/types";

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
  recentKeys,
  inSession = false,
  suggestions,
}: {
  variants: Variant[];
  onSelect: (variant: Variant) => void;
  onClose: () => void;
  /** Same-pattern variants sort first — for like-for-like swaps. */
  emphasizePattern?: MovementPattern;
  /** "exerciseId|modalityId" keys pinned as a Recent group while the search
   *  is empty — 95% of picks are the same handful of lifts. */
  recentKeys?: string[];
  /** Mid-workout: hide the authoring tags (default / no fail-safe). */
  inSession?: boolean;
  /** Swap mode: like-for-like picks pinned above Recent while the search is
   *  empty (see swapSuggestions). */
  suggestions?: SwapSuggestion[];
}) {
  const [search, setSearch] = useState("");
  // Autofocus only with a mouse/trackpad — on a phone or iPad it pops the
  // keyboard over the Recent list, which is usually the pick.
  const [autoFocus] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(pointer: fine)").matches,
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const recent = useMemo(() => {
    if (!recentKeys || recentKeys.length === 0 || search.trim()) return [];
    const byKey = new Map(
      variants.map((v) => [
        `${v.exerciseModality.exerciseId}|${v.exerciseModality.modalityId}`,
        v,
      ]),
    );
    return recentKeys.map((key) => byKey.get(key)).filter((v): v is Variant => !!v);
  }, [recentKeys, variants, search]);

  const groups = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = q
      ? variants.filter((v) =>
          [v.exerciseName, ...v.exerciseAliases, v.modalityName]
            .join(" ")
            .toLowerCase()
            .includes(q),
        )
      : variants;

    const byPattern = new Map<MovementPattern, Variant[]>();
    for (const variant of filtered) {
      const pattern = variant.pattern;
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

  // Portaled to <body> so no ancestor stacking context (opacity, transforms
  // on a board card) can trap this "fixed" overlay beneath a neighbor.
  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-scrim sm:p-4 sm:pt-16"
      onClick={onClose}
    >
      <div
        className="h-dvh w-full overflow-y-auto bg-surface p-4 sm:h-auto sm:max-h-[80vh] sm:max-w-lg sm:rounded-xl sm:border sm:border-border sm:shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3">
          <Input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search exercises…"
            autoFocus={autoFocus}
            className="w-full"
          />
          <Button variant="ghost" onClick={onClose}>
            Close
          </Button>
        </div>

        {!search.trim() &&
          (
            [
              ["equipment", "Same exercise, other equipment"],
              ["similar", "Similar exercises"],
            ] as const
          ).map(([kind, title]) => {
            const items = suggestions?.filter((s) => s.kind === kind) ?? [];
            if (items.length === 0) return null;
            return (
              <div key={kind} className="mt-4">
                <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-accent-text">
                  {title}
                </h3>
                <ul>
                  {items.map(({ variant, reason }) => (
                    <li key={`${kind}-${variant.exerciseModality.exerciseId}-${variant.exerciseModality.modalityId}`}>
                      <button
                        type="button"
                        onClick={() => onSelect(variant)}
                        className="flex min-h-11 w-full flex-wrap items-center gap-x-2 gap-y-0.5 rounded-md px-2 py-2 text-left text-sm hover:bg-current/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
                      >
                        <span>{variant.exerciseName}</span>
                        <ModalityChip modalityId={variant.exerciseModality.modalityId} />
                        {kind === "similar" && reason && (
                          <span className="text-xs text-muted">{reason}</span>
                        )}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}

        {recent.length > 0 && (
          <div className="mt-4">
            <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">
              Recent
            </h3>
            <ul>
              {recent.map((variant) => (
                <li key={`recent-${variant.exerciseModality.exerciseId}-${variant.exerciseModality.modalityId}`}>
                  <button
                    type="button"
                    onClick={() => onSelect(variant)}
                    className="flex min-h-11 w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm hover:bg-current/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
                  >
                    <span>{variant.exerciseName}</span>
                    <ModalityChip modalityId={variant.exerciseModality.modalityId} />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {groups.map(({ pattern, variants: group }) => (
          <div key={pattern} className="mt-4">
            <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">
              {PATTERN_LABELS[pattern]}
            </h3>
            <ul>
              {group.map((variant) => (
                <li key={`${variant.exerciseModality.exerciseId}-${variant.exerciseModality.modalityId}`}>
                  <button
                    type="button"
                    onClick={() => onSelect(variant)}
                    className="flex min-h-11 w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm hover:bg-current/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
                  >
                    <span>{variant.exerciseName}</span>
                    <ModalityChip modalityId={variant.exerciseModality.modalityId} />
                    {!inSession && !variant.allowsFailure && (
                      <span className="text-xs text-muted">no fail-safe</span>
                    )}
                    {!inSession && variant.exerciseModality.isDefault && (
                      <span className="text-xs text-muted">default</span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ))}
        {groups.length === 0 && (
          <p className="mt-4 text-sm text-muted">No variants match.</p>
        )}
      </div>
    </div>,
    document.body,
  );
}
