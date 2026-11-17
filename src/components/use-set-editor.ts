"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { getSuggestedLoad, syncSetLogs, updateSetLog } from "@/lib/actions/workout";
import { errorMessage } from "@/lib/format";
import { randomSuffix } from "@/lib/ids";
import { DEFAULT_STEADY_SECONDS, EMPTY_CONDITIONING } from "@/lib/conditioning";
import type { Variant } from "@/lib/queries";
import {
  cascadePatch,
  cascadeTargets,
  completeAsBodyweight,
  renumber,
  toBlocks,
  type Block,
} from "@/lib/set-blocks";
import type { RoutineExercise, Session, SetLog } from "@/lib/types";
import { variantKey, type ExerciseCatalog } from "@/lib/exercise-catalog";
import { freshSets, type LoadPrefill } from "@/lib/set-templates";

function clientSetId(): string {
  return `sl_${randomSuffix(8)}`;
}

/**
 * The editing kernel shared by the solo runner and each group-board card: a
 * session's set list as optimistic local state, with debounced single-row
 * saves for field edits and whole-list syncs for structural changes.
 */
export function useSetEditor(session: Session, initialSets: SetLog[], catalog: ExerciseCatalog) {
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

  /**
   * Field edit: optimistic local update, debounced single-row save. Editing a
   * prescription field (load, reps, time, distance) also applies it to the
   * later not-yet-performed sets of the same block, up to the first completed
   * one — even when the edited set is already logged, so fixing an
   * accidental early LOG fixes the sets still to do (see cascadeTargets).
   *
   * Everything is computed synchronously from setsRef — never inside the
   * setSets updater, whose execution React may defer past this function's
   * return (dropping the save and letting an older timer persist a stale
   * value, e.g. "13" from a fast-typed "135").
   */
  function patchSet(id: string, changes: Partial<SetLog>) {
    const current = setsRef.current;
    if (!current.some((s) => s.id === id)) return;
    const cascadeFields = cascadePatch(changes);
    const cascadeIds: ReadonlySet<string> = new Set(cascadeTargets(current, id, changes));

    const updated = new Map<string, SetLog>();
    const next = current.map((set) => {
      if (set.id === id) {
        const row = { ...set, ...changes };
        updated.set(set.id, row);
        return row;
      }
      if (cascadeIds.has(set.id)) {
        const row = { ...set, ...cascadeFields };
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
    const previous = setsRef.current;
    const renumbered = renumber(next);
    commit(renumbered);
    setBusy(true);
    syncSetLogs(session.id, renumbered)
      .catch((e) => {
        // Roll back so the screen matches the database — unless the list
        // already moved on, in which case the newer change's own sync (or
        // Finish's full flush) carries it. A failed field save needs no
        // rollback: Finish re-syncs the whole list either way.
        if (setsRef.current === renumbered) commit(previous);
        report(e);
      })
      .finally(() => setBusy(false));
  }

  /** Mark a set done — a 0 lb dumbbell/barbell set becomes bodyweight
   *  (completeAsBodyweight), which is a structural change. */
  function completeSet(id: string) {
    const converted = completeAsBodyweight(setsRef.current, id, (exerciseId) =>
      catalog.exerciseModalities.some(
        (em) => em.exerciseId === exerciseId && em.modalityId === "bodyweight",
      ),
    );
    if (converted) restructure(converted);
    else patchSet(id, { completed: true });
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
    rx?: RoutineExercise,
  ): Promise<LoadPrefill> {
    const prefill = await getSuggestedLoad(
      session.clientId,
      em.exerciseId,
      em.modalityId,
      rx ? rx.conditioning : undefined,
    ).catch(() => null);
    return {
      weightLbs: prefill?.weightLbs ?? null,
      addedWeightLbs: prefill?.addedWeightLbs ?? null,
      bandId: prefill?.bandId ?? null,
      bandRole: prefill?.bandRole ?? em.bandRoles[0] ?? null,
      target: prefill?.target,
    };
  }

  /** Replace a block's exercise: incomplete sets move to the new variant with
   *  the client's last-used load; completed sets stay as performed. */
  async function swapExercise(block: Block, variant: Variant) {
    const em = variant.exerciseModality;
    const { target, ...load } = await fetchPrefill(em);
    const toBike = variant.pattern === "conditioning";
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
              ...load,
              conditioning: toBike ? { ...EMPTY_CONDITIONING, ...target } : null,
              ...(toBike
                ? { reps: null, durationSeconds: set.durationSeconds ?? DEFAULT_STEADY_SECONDS }
                : {}),
            }
          : set,
      ),
    );
  }

  const fresh = (
    variant: Variant,
    prefill: LoadPrefill,
    count: number,
    position: number,
    rx?: RoutineExercise,
  ) => freshSets({ sessionId: session.id, variant, prefill, count, position, rx, newSetId: clientSetId });

  /** Append an ad-hoc exercise to the end of the session: `count` fresh sets
   *  prefilled with the client's last-used load. Returns the new sets so the
   *  caller can point its cursor at them. */
  async function addExercise(
    variant: Variant,
    count = variant.pattern === "conditioning" ? 1 : 3,
  ): Promise<SetLog[]> {
    const prefill = await fetchPrefill(variant.exerciseModality);
    // Re-read AFTER the await, same as swapExercise.
    const current = setsRef.current;
    const newSets = fresh(variant, prefill, count, current.length + 1);
    restructure([...current, ...newSets]);
    return newSets;
  }

  /** Append a whole routine (a finisher) to the end of the session in one
   *  sync: each prescription's set count, reps/time and band role, with the
   *  client's last-used loads. Prescriptions without a live variant are
   *  skipped. Returns the new sets for the caller's cursor. */
  async function addRoutine(
    prescriptions: readonly RoutineExercise[],
    variants: readonly Variant[],
  ): Promise<SetLog[]> {
    const byKey = new Map(
      variants.map((v) => [variantKey(v.exerciseModality.exerciseId, v.exerciseModality.modalityId), v]),
    );
    const planned = prescriptions.flatMap((rx) => {
      const variant = byKey.get(variantKey(rx.exerciseId, rx.modalityId));
      return variant && rx.sets > 0 ? [{ rx, variant }] : [];
    });
    const prefills = await Promise.all(
      planned.map(({ rx, variant }) => fetchPrefill(variant.exerciseModality, rx)),
    );
    // Re-read AFTER the await, same as swapExercise.
    const current = setsRef.current;
    const newSets: SetLog[] = [];
    planned.forEach(({ rx, variant }, i) => {
      newSets.push(
        ...fresh(variant, prefills[i], rx.sets, current.length + newSets.length + 1, rx),
      );
    });
    if (newSets.length > 0) restructure([...current, ...newSets]);
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
    completeSet,
    restructure,
    addSet,
    removeSet,
    removeBlock,
    swapExercise,
    addExercise,
    addRoutine,
    flush,
  };
}
