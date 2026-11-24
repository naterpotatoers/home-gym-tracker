"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { getLiveExtras, getSuggestedLoad, syncSetLogs, updateSetLog } from "@/lib/actions/workout";
import { errorMessage } from "@/lib/format";
import { randomSuffix } from "@/lib/ids";
import type { Variant } from "@/lib/queries";
import {
  cascadePatch,
  cascadeTargets,
  completeAsBodyweight,
  renumber,
  toBlocks,
  type Block,
} from "@/lib/set-blocks";
import type { LiveExtras } from "@/lib/live-session";
import type { RoutineExercise, Session, SetLog } from "@/lib/types";
import { variantKey, variantSignature, type ExerciseCatalog } from "@/lib/exercise-catalog";
import { freshSets, swappedSet, type LoadPrefill } from "@/lib/set-templates";
import { dropUnloggedBikeWarmups } from "@/lib/warmup";
import { isMigrationError, parseSnapshot, sameList, serializeSnapshot, snapshotKey } from "@/lib/pending-saves";

/** A failed save is followed by ONE full-list sync after this delay. */
const RESYNC_DELAY_MS = 3000;
/** Field edits batch their snapshot write (not one per keystroke); the
 *  snapshot is also written at once on structural changes, failures, and
 *  whenever the page hides. */
const SNAPSHOT_DEBOUNCE_MS = 300;

/** Snapshot timestamp — only ever called from event handlers and timers. */
function stampNow(): number {
  return Date.now();
}

function clientSetId(): string {
  return `sl_${randomSuffix(8)}`;
}

/**
 * The editing kernel shared by the solo runner and each group-board card: a
 * session's set list as optimistic local state, with debounced single-row
 * saves for field edits and whole-list syncs for structural changes. Also
 * owns the server-derived extras (stalls, finisher options), refreshed when
 * a sync changes which variants the session trains.
 */
export function useSetEditor(
  session: Session,
  initialSets: SetLog[],
  catalog: ExerciseCatalog,
  initialExtras: LiveExtras,
) {
  const [sets, setSets] = useState<SetLog[]>(initialSets);
  const [extras, setExtras] = useState<LiveExtras>(initialExtras);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const saveTimers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  /** Rows edited but not yet saved — what a flush must persist. */
  const pendingSaves = useRef(new Map<string, SetLog>());
  /** Always the latest list — async code (post-await, flush handlers) must
   *  read this, never a `sets` closure that may predate an await or event. */
  const setsRef = useRef(initialSets);
  /** Blocks whose swap is waiting on its prefill — shown as "Swapping…". */
  const [swapping, setSwapping] = useState<ReadonlySet<string>>(() => new Set());

  // ---- Set-list snapshot (see pending-saves.ts) ----
  /** Set once the session is flushed for Finish or discarded: stop
   *  snapshotting. Any later edit (finish/discard failed, work continues)
   *  reopens it. */
  const closed = useRef(false);
  const resyncTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const snapshotTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** The error message the pending resync would resolve — only that one is
   *  cleared when it succeeds. */
  const retryingFor = useRef<string | null>(null);
  function writeSnapshot(next: readonly SetLog[] | null) {
    try {
      const key = snapshotKey(session.id);
      if (next === null) localStorage.removeItem(key);
      else localStorage.setItem(key, serializeSnapshot(next, stampNow()));
    } catch {
      // Private mode / storage full: saves still go out, just unprotected.
    }
  }

  const blocks = useMemo(() => toBlocks(sets), [sets]);

  /** Write the snapshot of the current list now (cancelling a pending one).
   *  Only a session in progress has unsaved work worth protecting. */
  function saveSnapshotNow() {
    if (snapshotTimer.current !== null) clearTimeout(snapshotTimer.current);
    snapshotTimer.current = null;
    if (!closed.current && session.status === "planned") writeSnapshot(setsRef.current);
  }

  /** The only way the list changes — so the snapshot always follows it. */
  function commit(next: SetLog[]) {
    closed.current = false;
    setsRef.current = next;
    setSets(next);
    if (snapshotTimer.current === null) {
      snapshotTimer.current = setTimeout(saveSnapshotNow, SNAPSHOT_DEBOUNCE_MS);
    }
  }

  // ---- Server-derived extras (see LiveExtras) ----
  const extrasFor = useRef(variantSignature(initialSets));
  const extrasRequest = useRef(0);
  /** After a successful sync of `list`: if it trains different variants than
   *  the extras were computed for, re-derive them (latest request wins). */
  function afterSync(list: readonly SetLog[]) {
    const signature = variantSignature(list);
    if (signature === extrasFor.current) return;
    extrasFor.current = signature;
    const request = ++extrasRequest.current;
    getLiveExtras(session.id)
      .then((next) => {
        if (next && request === extrasRequest.current) setExtras(next);
      })
      .catch(() => {}); // cosmetic — stale chips until the next sync or load
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
    saveSnapshotNow();
    clearTimers();
    const rows = [...pendingSaves.current.values()];
    pendingSaves.current.clear();
    // The snapshot already holds these rows; if the page dies before the
    // saves run, the next load re-sends them.
    for (const row of rows) void updateSetLog(row).catch(() => {});
  }
  // Latest-ref pattern (as in use-debounced-save): the once-registered
  // listeners always call the newest closure.
  const flushPendingRef = useRef(flushPending);
  const commitRef = useRef(commit);
  const retryLaterRef = useRef(retryLater);
  const afterSyncRef = useRef(afterSync);
  useEffect(() => {
    flushPendingRef.current = flushPending;
    commitRef.current = commit;
    retryLaterRef.current = retryLater;
    afterSyncRef.current = afterSync;
  });

  // On load, adopt this device's snapshot if it differs from the server's
  // list (saves lost to a reload or tab eviction) and persist it in one
  // atomic sync. Only for a session still in progress — a finished one is
  // never rewritten, and a snapshot naming a variant the catalog no longer
  // has (merged at /exercises meanwhile) is dropped — it could never sync.
  // Deferred a tick (state updates stay out of the effect body) and run
  // once: `initialSets` is the mount list.
  const restoreRef = useRef({
    sessionId: session.id,
    live: session.status === "planned",
    initialSets,
    known: new Set(catalog.exerciseModalities.map((em) => variantKey(em.exerciseId, em.modalityId))),
  });
  useEffect(() => {
    const { sessionId, live, initialSets: server, known } = restoreRef.current;
    if (!live) return;
    const timer = setTimeout(() => {
      let raw: string | null = null;
      try {
        raw = localStorage.getItem(snapshotKey(sessionId));
      } catch {
        return;
      }
      const local = parseSnapshot(raw, sessionId, stampNow());
      if (!local || local.some((set) => !known.has(variantKey(set.exerciseId, set.modalityId)))) return;
      // Only before any edit on this load — never clobber newer local work.
      if (sameList(local, server) || setsRef.current !== server) return;
      commitRef.current(local);
      syncSetLogs(sessionId, local).then(
        () => afterSyncRef.current(local),
        (e) => retryLaterRef.current(e),
      );
    }, 0);
    return () => clearTimeout(timer);
  }, []);

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
          if (pending) updateSetLog(pending).catch(retryLater);
        }, 600),
      );
    }
  }

  /**
   * A save failed — and whether it landed is unknown (a dropped connection,
   * a server-side timeout after the write committed, the browser aborting it
   * for a reload). Never roll back: keep the change (and its snapshot),
   * report it, and try ONE full-list sync shortly after — it's idempotent
   * and carries every edit. A failure there is left to Finish's flush or the
   * next load's snapshot restore. A migration error isn't transient: it's
   * shown and kept.
   */
  function retryLater(e: unknown) {
    const message = errorMessage(e, "Save failed.");
    setError(message);
    saveSnapshotNow();
    if (isMigrationError(message) || closed.current) return;
    retryingFor.current = message;
    if (resyncTimer.current !== null) return;
    resyncTimer.current = setTimeout(() => {
      resyncTimer.current = null;
      const list = setsRef.current;
      syncSetLogs(session.id, list).then(
        () => {
          const resolved = retryingFor.current;
          retryingFor.current = null;
          // Clear only the error this retry resolved, never a newer one.
          setError((shown) => (shown === resolved ? null : shown));
          afterSync(list);
        },
        report,
      );
    }, RESYNC_DELAY_MS);
  }

  function cancelResync() {
    if (resyncTimer.current !== null) clearTimeout(resyncTimer.current);
    resyncTimer.current = null;
  }

  /** Structural change: renumber locally, then sync the whole list. The sync
   *  supersedes every pending single-row save — a debounced upsert firing
   *  after the sync would resurrect a deleted row, so drop them first. */
  function restructure(next: SetLog[]) {
    clearTimers();
    cancelResync(); // this sync carries everything a resync would
    pendingSaves.current.clear();
    const renumbered = renumber(next);
    commit(renumbered);
    saveSnapshotNow(); // a structural change is protected immediately
    setBusy(true);
    // No rollback on failure (see retryLater): the outcome is unknown — the
    // browser aborts in-flight requests on reload BEFORE pagehide, and a
    // server-side timeout may fire after the write committed. Rolling back
    // would rewrite the snapshot and lose the change.
    syncSetLogs(session.id, renumbered)
      .then(() => afterSync(renumbered), retryLater)
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
    setSwapping((keys) => new Set(keys).add(block.key));
    try {
      const prefill = await fetchPrefill(variant.exerciseModality);
      // Re-read AFTER the await — edits made while the prefill was in flight
      // must survive the sync (which deletes rows missing from its list). A
      // set completed during the await stays as performed; a block removed
      // meanwhile is simply not swapped.
      const blockIds = new Set(block.sets.map((s) => s.id));
      const current = setsRef.current;
      if (!current.some((set) => blockIds.has(set.id) && !set.completed)) return;
      restructure(
        current.map((set) =>
          blockIds.has(set.id) && !set.completed ? swappedSet(set, variant, prefill) : set,
        ),
      );
    } catch (e) {
      report(e);
    } finally {
      setSwapping((keys) => {
        const next = new Set(keys);
        next.delete(block.key);
        return next;
      });
    }
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
   *  before finishing the session. An unlogged bike warm-up is dropped here
   *  (it didn't happen); the sync is one transaction, so the delete and the
   *  renumber land together. */
  async function flush() {
    clearTimers();
    pendingSaves.current.clear();
    const kept = dropUnloggedBikeWarmups(setsRef.current);
    const next = kept === setsRef.current ? kept : renumber(kept);
    if (next !== setsRef.current) commit(next);
    cancelResync();
    await syncSetLogs(session.id, next);
    // Everything is saved and the session is about to close. (A later edit,
    // if finishing then fails, schedules a fresh snapshot.)
    if (snapshotTimer.current !== null) clearTimeout(snapshotTimer.current);
    snapshotTimer.current = null;
    writeSnapshot(null);
    closed.current = true;
  }

  /** Forget this device's unsaved edits (the session was discarded). */
  function forgetUnsaved() {
    closed.current = true;
    clearTimers();
    cancelResync();
    if (snapshotTimer.current !== null) clearTimeout(snapshotTimer.current);
    snapshotTimer.current = null;
    pendingSaves.current.clear();
    writeSnapshot(null);
  }

  return {
    sets,
    blocks,
    error,
    busy,
    swapping,
    stalls: extras.stalls,
    finishers: extras.finishers,
    forgetUnsaved,
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
