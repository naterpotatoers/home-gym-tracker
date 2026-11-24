"use client";

import { useMemo, useState } from "react";
import type { useSetEditor } from "@/components/use-set-editor";
import {
  advanceCursor,
  cursorOrder,
  performOrder,
  resolveCursor,
  restAfterLog,
  supersetGroups,
} from "@/lib/session-labels";
import type { Block } from "@/lib/set-blocks";
import type { RoutineExercise, SetLog } from "@/lib/types";
import { isBikeWarmupBlock } from "@/lib/warmup";

export type SetEditor = ReturnType<typeof useSetEditor>;

/**
 * The live-session flow state shared by the solo runner and each group-board
 * card: the id-based forward-only cursor, which block is expanded, and the
 * rest timer. Pure cursor logic lives in session-labels.ts; this hook owns
 * the React state around it.
 *
 * `now` is a ticking timestamp provided by the caller's clock — nothing here
 * calls Date.now() during render. Rest deadlines are anchored with Date.now()
 * at LOG time (an event, not render): the 1 s tick can lag by up to a second,
 * and is 0 before its first tick, which would read as a rest already over.
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
  /** Sets passed over with Skip this visit — the cursor walks around them
   *  (so a superset partner still comes up) until the block is tapped. */
  const [skipped, setSkipped] = useState<ReadonlySet<string>>(() => new Set());
  const walk = useMemo(() => cursorOrder(ordered, skipped), [ordered, skipped]);

  // Id-based cursor: survives restructures (add/remove/swap rebuild the sets
  // array) and only ever resolves FORWARD — a skipped exercise stays skipped.
  const current = resolveCursor(walk, cursorId) ?? undefined;
  const currentBlock = current
    ? editor.blocks.find((b) => b.sets.some((s) => s.id === current.id))
    : undefined;
  const shownKey = expandedKey ?? currentBlock?.key ?? null;

  const restSecondsLeft =
    restUntil !== null && now > 0 ? Math.ceil((restUntil - now) / 1000) : null;
  const resting = restSecondsLeft !== null && restSecondsLeft > 0;
  const ready = restSecondsLeft !== null && restSecondsLeft <= 0;

  /** Start (or clear) the rest timer: `seconds` from right now. */
  function startRest(seconds: number | null) {
    setRestUntil(seconds === null ? null : Date.now() + seconds * 1000);
  }

  function logCurrent() {
    if (!current) return;
    // advanceCursor looks strictly after `current`, so computing it before the
    // patch lands is safe. With nothing ahead the cursor parks on the logged
    // set itself, which self-recovers if more sets get appended later.
    const nextId = advanceCursor(walk, current.id);
    const next = nextId !== null ? walk.find((s) => s.id === nextId) : undefined;
    editor.completeSet(current.id);
    startRest(restAfterLog(current, next, prescriptions, supersets));
    setCursorId(nextId ?? current.id);
    setExpandedKey(null); // follow the flow to the next block
  }

  /** Complete any set — LOG on whichever row is active. The current set goes
   *  through logCurrent (rest timer, cursor);
   *  any other set is marked done and still starts its rest. With
   *  `rest: false` (re-confirming a corrected set) it is only marked done —
   *  no rest restart, no cursor move. */
  function logSet(setId: string, { rest = true }: { rest?: boolean } = {}) {
    if (!rest) {
      editor.completeSet(setId);
      return;
    }
    if (current && setId === current.id) {
      logCurrent();
      return;
    }
    const set = editor.sets.find((s) => s.id === setId);
    if (!set) return;
    editor.completeSet(setId);
    startRest(restAfterLog(set, undefined, prescriptions, supersets));
  }

  function tapBlock(block: Block) {
    // Upcoming (or skipped) block: move the workout there. Finished block:
    // just open it for edits without touching the LOG cursor. Tapping a
    // later exercise still works as a skip; unchecked sets never count
    // toward anything.
    const firstIncomplete = block.sets.find((s) => !s.completed);
    if (firstIncomplete) {
      unskip(block);
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
      setCursorId(advanceCursor(walk, current.id));
    }
    editor.removeSet(setId);
  }

  function removeBlockKeepingCursor(block: Block) {
    if (current && block.sets.some((s) => s.id === current.id)) {
      setCursorId(survivorAfter(current.id, walk, new Set(block.sets.map((s) => s.id))));
    }
    editor.removeBlock(block);
  }

  /** The next incomplete set after `fromId` in `order` that isn't in
   *  `excluded` — where the cursor goes when its own block leaves. */
  function survivorAfter(fromId: string, order: readonly SetLog[], excluded: ReadonlySet<string>) {
    const at = order.findIndex((s) => s.id === fromId);
    return order.find((s, i) => i > at && !s.completed && !excluded.has(s.id))?.id ?? null;
  }

  function unskip(block: Block) {
    if (!block.sets.some((s) => skipped.has(s.id))) return;
    setSkipped((prev) => new Set([...prev].filter((id) => !block.sets.some((s) => s.id === id))));
  }

  /** Skip the current exercise. The bike warm-up just goes (an unlogged
   *  warm-up is nothing worth keeping); anything else stays in the list,
   *  unlogged, and the cursor moves on — tap it to come back. */
  function skipBlock(block: Block) {
    if (isBikeWarmupBlock(block)) {
      removeBlockKeepingCursor(block);
      return;
    }
    const ids = new Set(block.sets.filter((s) => !s.completed).map((s) => s.id));
    if (current && ids.has(current.id)) {
      setCursorId(survivorAfter(current.id, ordered, new Set([...skipped, ...ids])));
    }
    setSkipped((prev) => new Set([...prev, ...ids]));
    setExpandedKey(null);
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
    logSet,
    tapBlock,
    collapseExpanded,
    removeSetKeepingCursor,
    removeBlockKeepingCursor,
    skipBlock,
    unskip,
    onExerciseAdded,
  };
}

export type SessionFlow = ReturnType<typeof useSessionFlow>;
