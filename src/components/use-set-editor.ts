"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { getSuggestedLoad, syncSetLogs, updateSetLog } from "@/lib/actions/workout";
import { errorMessage } from "@/lib/format";
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
  /** Rows edited but not yet saved — what a flush must persist. */
  const pendingSaves = useRef(new Map<string, SetLog>());
  /** Always the latest list — async code (post-await, flush handlers) must
   *  read this, never a `sets` closure that may predate an await or event. */
  const setsRef = useRef(initialSets);

  const blocks = useMemo(() => toBlocks(sets), [sets]);

  function commit(next: SetLog[]) {
    setsRef.current = next;
    setSets(next);
  }

  function report(e: unknown) {
    setError(errorMessage(e, "Save failed."));
  }

  function clearTimers() {
    for (const timer of saveTimers.current.values()) clearTimeout(timer);
    saveTimers.current.clear();
  }

  /** Persist every pending row NOW — the tab may be about to be evicted, so
   *  fire-and-forget; there may be no state left to report errors into. */
  function flushPending() {
    clearTimers();
    const rows = [...pendingSaves.current.values()];
    pendingSaves.current.clear();
    for (const row of rows) void updateSetLog(row).catch(() => {});
  }
  // Latest-ref pattern (as in use-debounced-save): the once-registered
  // listeners always call the newest closure.
  const flushPendingRef = useRef(flushPending);
  useEffect(() => {
    flushPendingRef.current = flushPending;
  });

  // Safari evicts backgrounded iPad tabs, killing debounce timers with them
  // (use-session-clock survives this via localStorage; the sets survive by
  // saving the moment the tab hides). pagehide covers bfcache navigations,
  // unmount covers in-app route changes.
  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === "hidden") flushPendingRef.current();
    };
    const onPageHide = () => flushPendingRef.current();
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", onPageHide);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", onPageHide);
      flushPendingRef.current();
    };
  }, []);

  /** Load fields cascade forward when edited — "update once, rolls out". */
  const LOAD_KEYS = ["weightLbs", "addedWeightLbs", "bandId", "bandRole"] as const;

  /**
   * Field edit: optimistic local update, debounced single-row save. Editing a
   * load field on an INCOMPLETE set also applies it to every later incomplete
   * set of the same exercise block; completed sets are never touched, and
   * fixing a completed set never cascades.
   *
   * Everything is computed synchronously from setsRef — never inside the
   * setSets updater, whose execution React may defer past this function's
   * return (dropping the save and letting an older timer persist a stale
   * value, e.g. "13" from a fast-typed "135").
   */
  function patchSet(id: string, changes: Partial<SetLog>) {
    const current = setsRef.current;
    const target = current.find((s) => s.id === id);
    if (!target) return;
    const loadPatch: Partial<SetLog> = {};
    for (const key of LOAD_KEYS) {
      if (key in changes) (loadPatch as Record<string, unknown>)[key] = changes[key];
    }
    let cascadeIds: ReadonlySet<string> = new Set();
    if (!target.completed && Object.keys(loadPatch).length > 0) {
      const block = toBlocks(current).find((b) => b.sets.some((s) => s.id === id));
      if (block) {
        cascadeIds = new Set(
          block.sets
            .filter((s) => s.position > target.position && !s.completed)
            .map((s) => s.id),
        );
      }
    }

    const updated = new Map<string, SetLog>();
    const next = current.map((set) => {
      if (set.id === id) {
        const row = { ...set, ...changes };
        updated.set(set.id, row);
        return row;
      }
      if (cascadeIds.has(set.id)) {
        const row = { ...set, ...loadPatch };
        updated.set(set.id, row);
        return row;
      }
      return set;
    });
    commit(next);

    const timers = saveTimers.current;
    for (const [setId, row] of updated) {
      pendingSaves.current.set(setId, row);
      clearTimeout(timers.get(setId));
      timers.set(
        setId,
        setTimeout(() => {
          timers.delete(setId);
          const pending = pendingSaves.current.get(setId);
          pendingSaves.current.delete(setId);
          if (pending) updateSetLog(pending).catch(report);
        }, 600),
      );
    }
  }

  /** Structural change: renumber locally, then sync the whole list. The sync
   *  supersedes every pending single-row save — a debounced upsert firing
   *  after the sync would resurrect a deleted row, so drop them first. */
  function restructure(next: SetLog[]) {
    clearTimers();
    pendingSaves.current.clear();
    const renumbered = renumber(next);
    commit(renumbered);
    setBusy(true);
    syncSetLogs(session.id, renumbered)
      .catch(report)
      .finally(() => setBusy(false));
  }

  function addSet(block: Block) {
    const current = setsRef.current;
    const template = block.sets.at(-1)!;
    const index = current.findIndex((s) => s.id === template.id);
    const next = [...current];
    next.splice(index + 1, 0, { ...template, id: clientSetId(), completed: false });
    restructure(next);
  }

  function removeSet(id: string) {
    restructure(setsRef.current.filter((s) => s.id !== id));
  }

  /** Drop an entire exercise from the session — one structural sync. */
  function removeBlock(block: Block) {
    const ids = new Set(block.sets.map((s) => s.id));
    restructure(setsRef.current.filter((s) => !ids.has(s.id)));
  }

  /** The client's last-used load for a variant, with the variant's own band
   *  role as the fallback — shared by swap and add so they can't drift. */
  async function fetchPrefill(
    em: Variant["exerciseModality"],
  ): Promise<Pick<SetLog, "weightLbs" | "addedWeightLbs" | "bandId" | "bandRole">> {
    const prefill = await getSuggestedLoad(
      session.clientId,
      em.exerciseId,
      em.modalityId,
    ).catch(() => null);
    return {
      weightLbs: prefill?.weightLbs ?? null,
      addedWeightLbs: prefill?.addedWeightLbs ?? null,
      bandId: prefill?.bandId ?? null,
      bandRole: prefill?.bandRole ?? em.bandRoles[0] ?? null,
    };
  }

  /** Replace a block's exercise: incomplete sets move to the new variant with
   *  the client's last-used load; completed sets stay as performed. */
  async function swapExercise(block: Block, variant: Variant) {
    const em = variant.exerciseModality;
    const prefill = await fetchPrefill(em);
    // Re-read AFTER the await — edits made while the prefill was in flight
    // must survive the sync (which deletes rows missing from its list). A set
    // completed during the await stays as performed.
    const blockIds = new Set(block.sets.map((s) => s.id));
    restructure(
      setsRef.current.map((set) =>
        blockIds.has(set.id) && !set.completed
          ? {
              ...set,
              exerciseId: em.exerciseId,
              modalityId: em.modalityId,
              unilateralMode: em.defaultUnilateralMode,
              ...prefill,
            }
          : set,
      ),
    );
  }

  /** Append an ad-hoc exercise to the end of the session: `count` fresh sets
   *  prefilled with the client's last-used load. Returns the new sets so the
   *  caller can point its cursor at them. */
  async function addExercise(variant: Variant, count = 3): Promise<SetLog[]> {
    const em = variant.exerciseModality;
    const prefill = await fetchPrefill(em);
    // Re-read AFTER the await, same as swapExercise.
    const current = setsRef.current;
    const timed = variant.metricType === "time";
    const newSets = Array.from({ length: count }, (_, i): SetLog => ({
      id: clientSetId(),
      sessionId: session.id,
      exerciseId: em.exerciseId,
      modalityId: em.modalityId,
      // renumber() inside restructure re-derives both of these
      position: current.length + i + 1,
      setNumber: i + 1,
      unilateralMode: em.defaultUnilateralMode,
      side: null,
      reps: timed ? null : 10,
      ...prefill,
      durationSeconds: timed ? 30 : null,
      distanceFeet: null,
      rir: null,
      isWarmup: false,
      completed: false,
      notes: "",
    }));
    restructure([...current, ...newSets]);
    return newSets;
  }

  /** Cancel pending debounced saves and persist the current list — call
   *  before finishing the session. */
  async function flush() {
    clearTimers();
    pendingSaves.current.clear();
    await syncSetLogs(session.id, setsRef.current);
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
    addExercise,
    flush,
  };
}
