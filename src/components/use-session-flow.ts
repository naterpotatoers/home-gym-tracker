"use client";

import { useMemo, useState } from "react";
import type { useSetEditor } from "@/components/use-set-editor";
import {
  advanceCursor,
  performOrder,
  resolveCursor,
  supersetGroups,
} from "@/lib/session-labels";
import type { Block } from "@/lib/set-blocks";
import type { RoutineExercise, SetLog } from "@/lib/types";

export type SetEditor = ReturnType<typeof useSetEditor>;

/**
 * The live-session flow state shared by the solo runner and each group-board
 * card: the id-based forward-only cursor, which block is expanded, and the
 * rest timer. Pure cursor logic lives in session-labels.ts; this hook owns
 * the React state around it.
 *
 * `now` is a ticking timestamp provided by the caller's clock — nothing here
 * calls Date.now() during render.
 */
export function useSessionFlow(
  editor: SetEditor,
  prescriptions: readonly RoutineExercise[],
  now: number,
) {
  // Superset pairing: the cursor (and only the cursor) walks the sets in
  // performance order, where adjacent labeled blocks interleave round by
  // round. Storage order stays grouped.
  const supersets = useMemo(() => supersetGroups(prescriptions), [prescriptions]);
  const ordered = useMemo(
    () => performOrder(editor.sets, supersets),
    [editor.sets, supersets],
  );

  const [cursorId, setCursorId] = useState<string | null>(
    () => ordered.find((s) => !s.completed)?.id ?? null,
  );
  /** Block explicitly opened by tap; null = follow the current block. */
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [restUntil, setRestUntil] = useState<number | null>(null);

  // Id-based cursor: survives restructures (add/remove/swap rebuild the sets
  // array) and only ever resolves FORWARD — a skipped exercise stays skipped.
  const current = resolveCursor(ordered, cursorId) ?? undefined;
  const currentBlock = current
    ? editor.blocks.find((b) => b.sets.some((s) => s.id === current.id))
    : undefined;
  const shownKey = expandedKey ?? currentBlock?.key ?? null;

  const restSecondsLeft =
    restUntil !== null && now > 0 ? Math.ceil((restUntil - now) / 1000) : null;
  const resting = restSecondsLeft !== null && restSecondsLeft > 0;
  const ready = restSecondsLeft !== null && restSecondsLeft <= 0;

  function logCurrent() {
    if (!current) return;
    const rx = prescriptions.find(
      (p) => p.exerciseId === current.exerciseId && p.modalityId === current.modalityId,
    );
    // advanceCursor looks strictly after `current`, so computing it before the
    // patch lands is safe. With nothing ahead the cursor parks on the logged
    // set itself, which self-recovers if more sets get appended later.
    const nextId = advanceCursor(ordered, current.id);
    // No rest inside a superset pair — the "rest" is the partner exercise.
    // The prescription's rest applies once the round hands back to a new
    // exercise (or the pair is done).
    const next = nextId !== null ? ordered.find((s) => s.id === nextId) : undefined;
    const currentKey = `${current.exerciseId}|${current.modalityId}`;
    const label = supersets.get(currentKey);
    const pairedNext =
      next !== undefined &&
      label !== undefined &&
      `${next.exerciseId}|${next.modalityId}` !== currentKey &&
      supersets.get(`${next.exerciseId}|${next.modalityId}`) === label;
    editor.patchSet(current.id, { completed: true });
    setRestUntil(rx && !pairedNext ? now + rx.restSeconds * 1000 : null);
    setCursorId(nextId ?? current.id);
    setExpandedKey(null); // follow the flow to the next block
  }

  function tapBlock(block: Block) {
    // Upcoming block: move the workout there. Finished block: just open it
    // for edits without touching the LOG cursor. (There is no explicit
    // "skip" — tapping the next exercise IS the skip; unchecked sets never
    // count toward anything.)
    const firstIncomplete = block.sets.find((s) => !s.completed);
    if (firstIncomplete) {
      setCursorId(firstIncomplete.id);
      setExpandedKey(null); // it becomes the current block, which auto-expands
    } else {
      setExpandedKey(block.key === shownKey ? null : block.key);
    }
  }

  // Removing the set/block the cursor sits on would strand it on a dead id
  // (parked); re-aim it at the next incomplete survivor ahead first.
  function removeSetKeepingCursor(setId: string) {
    if (current && setId === current.id) {
      setCursorId(advanceCursor(ordered, current.id));
    }
    editor.removeSet(setId);
  }

  function removeBlockKeepingCursor(block: Block) {
    if (current && block.sets.some((s) => s.id === current.id)) {
      const at = ordered.findIndex((s) => s.id === current.id);
      const survivor = ordered.find(
        (s, i) => i > at && !s.completed && !block.sets.some((b) => b.id === s.id),
      );
      setCursorId(survivor?.id ?? null);
    }
    editor.removeBlock(block);
  }

  /** A parked cursor (nothing ahead) jumps to freshly appended work; an
   *  in-flight cursor is unaffected by an append. */
  function onExerciseAdded(newSets: SetLog[]) {
    if (!current && newSets.length > 0) setCursorId(newSets[0].id);
  }

  /** Close a manually opened block without touching the cursor. */
  function collapseExpanded() {
    setExpandedKey(null);
  }

  return {
    current,
    currentBlock,
    shownKey,
    /** Variant key → superset label, for paired-block display. */
    supersets,
    restSecondsLeft,
    resting,
    ready,
    logCurrent,
    tapBlock,
    collapseExpanded,
    removeSetKeepingCursor,
    removeBlockKeepingCursor,
    onExerciseAdded,
  };
}

export type SessionFlow = ReturnType<typeof useSessionFlow>;
