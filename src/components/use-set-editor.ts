"use client";

import { useMemo, useRef, useState } from "react";
import { getSuggestedLoad, syncSetLogs, updateSetLog } from "@/lib/actions/workout";
import { randomSuffix } from "@/lib/ids";
import type { Variant } from "@/lib/queries";
import { renumber, toBlocks, type Block } from "@/lib/set-blocks";
import type { Session, SetLog } from "@/lib/types";

function clientSetId(): string {
  return `sl_${randomSuffix(8)}`;
}

/**
 * The editing kernel shared by the solo runner and each group-board card: a
 * session's set list as optimistic local state, with debounced single-row
 * saves for field edits and whole-list syncs for structural changes.
 */
export function useSetEditor(session: Session, initialSets: SetLog[]) {
  const [sets, setSets] = useState<SetLog[]>(initialSets);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const saveTimers = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  const blocks = useMemo(() => toBlocks(sets), [sets]);

  function report(e: unknown) {
    setError(e instanceof Error ? e.message : "Save failed.");
  }

  /** Load fields cascade forward when edited — "update once, rolls out". */
  const LOAD_KEYS = ["weightLbs", "addedWeightLbs", "bandId", "bandRole"] as const;

  /**
   * Field edit: optimistic local update, debounced single-row save. Editing a
   * load field on an INCOMPLETE set also applies it to every later incomplete
   * set of the same exercise block; completed sets are never touched, and
   * fixing a completed set never cascades.
   */
  function patchSet(id: string, changes: Partial<SetLog>) {
    const target = sets.find((s) => s.id === id);
    const loadPatch: Partial<SetLog> = {};
    for (const key of LOAD_KEYS) {
      if (key in changes) (loadPatch as Record<string, unknown>)[key] = changes[key];
    }
    let cascadeIds: ReadonlySet<string> = new Set();
    if (target && !target.completed && Object.keys(loadPatch).length > 0) {
      const block = blocks.find((b) => b.sets.some((s) => s.id === id));
      if (block) {
        cascadeIds = new Set(
          block.sets
            .filter((s) => s.position > target.position && !s.completed)
            .map((s) => s.id),
        );
      }
    }

    const updated = new Map<string, SetLog>();
    setSets((prev) =>
      prev.map((set) => {
        if (set.id === id) {
          const next = { ...set, ...changes };
          updated.set(set.id, next);
          return next;
        }
        if (cascadeIds.has(set.id)) {
          const next = { ...set, ...loadPatch };
          updated.set(set.id, next);
          return next;
        }
        return set;
      }),
    );

    const timers = saveTimers.current;
    for (const [setId] of updated) {
      clearTimeout(timers.get(setId));
      timers.set(
        setId,
        setTimeout(() => {
          const row = updated.get(setId);
          if (row) updateSetLog(row).catch(report);
        }, 600),
      );
    }
  }

  /** Structural change: renumber locally, then sync the whole list. */
  function restructure(next: SetLog[]) {
    const renumbered = renumber(next);
    setSets(renumbered);
    setBusy(true);
    syncSetLogs(session.id, renumbered)
      .catch(report)
      .finally(() => setBusy(false));
  }

  function addSet(block: Block) {
    const template = block.sets.at(-1)!;
    const index = sets.findIndex((s) => s.id === template.id);
    const next = [...sets];
    next.splice(index + 1, 0, { ...template, id: clientSetId(), completed: false });
    restructure(next);
  }

  function removeSet(id: string) {
    restructure(sets.filter((s) => s.id !== id));
  }

  /** Drop an entire exercise from the session — one structural sync. */
  function removeBlock(block: Block) {
    const ids = new Set(block.sets.map((s) => s.id));
    restructure(sets.filter((s) => !ids.has(s.id)));
  }

  /** Replace a block's exercise: incomplete sets move to the new variant with
   *  the client's last-used load; completed sets stay as performed. */
  async function swapExercise(block: Block, variant: Variant) {
    const em = variant.exerciseModality;
    const prefill = await getSuggestedLoad(
      session.clientId,
      em.exerciseId,
      em.modalityId,
    ).catch(() => null);
    const blockIds = new Set(block.sets.filter((s) => !s.completed).map((s) => s.id));
    restructure(
      sets.map((set) =>
        blockIds.has(set.id)
          ? {
              ...set,
              exerciseId: em.exerciseId,
              modalityId: em.modalityId,
              unilateralMode: em.defaultUnilateralMode,
              weightLbs: prefill?.weightLbs ?? null,
              addedWeightLbs: prefill?.addedWeightLbs ?? null,
              bandId: prefill?.bandId ?? null,
              bandRole: prefill?.bandRole ?? em.bandRoles[0] ?? null,
            }
          : set,
      ),
    );
  }

  /** Cancel pending debounced saves and persist the current list — call
   *  before finishing the session. */
  async function flush() {
    for (const timer of saveTimers.current.values()) clearTimeout(timer);
    saveTimers.current.clear();
    await syncSetLogs(session.id, sets);
  }

  return {
    sets,
    blocks,
    error,
    busy,
    setError,
    patchSet,
    restructure,
    addSet,
    removeSet,
    removeBlock,
    swapExercise,
    flush,
  };
}
