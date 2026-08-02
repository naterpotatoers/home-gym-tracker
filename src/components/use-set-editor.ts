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

  /** Field edit: optimistic local update, debounced single-row save. */
  function patchSet(id: string, changes: Partial<SetLog>) {
    let updated: SetLog | undefined;
    setSets((prev) =>
      prev.map((set) => {
        if (set.id !== id) return set;
        updated = { ...set, ...changes };
        return updated;
      }),
    );
    const timers = saveTimers.current;
    clearTimeout(timers.get(id));
    timers.set(
      id,
      setTimeout(() => {
        if (updated) updateSetLog(updated).catch(report);
      }, 600),
    );
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
    swapExercise,
    flush,
  };
}
