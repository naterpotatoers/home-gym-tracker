"use client";

import { useEffect, useRef, useState } from "react";
import { errorMessage } from "@/lib/format";

/**
 * Debounced autosave: run `save` ~1s after the last change to `deps`,
 * skipping the initial render. Returns the shared saving/saved/error state
 * the header status lines render, plus `flush` (save now, e.g. before a
 * duplicate reads the DB) and `cancel` (stop saving for good, e.g. before a
 * delete — a late save must not race it).
 */
export function useDebouncedSave(
  deps: readonly unknown[],
  save: () => Promise<void>,
  delayMs = 1000,
) {
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">("idle");
  const [error, setError] = useState<string | null>(null);
  const firstRender = useRef(true);
  const saveRef = useRef(save);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Edit generations: bumped per change, recorded when a save that started
   *  at that generation lands. Pending = they differ. A boolean can't do this
   *  — an older save finishing would mark a newer, still-debouncing edit as
   *  saved, and the unmount flush / tab-close guard would then skip it. */
  const editGen = useRef(0);
  const savedGen = useRef(0);
  const cancelled = useRef(false);

  // Latest-ref pattern: the debounce timer always calls the newest save
  // closure without retriggering on every render.
  useEffect(() => {
    saveRef.current = save;
  });

  function isPending() {
    return !cancelled.current && editGen.current !== savedGen.current;
  }

  function clearTimer() {
    if (timerRef.current !== null) clearTimeout(timerRef.current);
    timerRef.current = null;
  }

  async function runSave() {
    const gen = editGen.current;
    try {
      await saveRef.current();
      savedGen.current = Math.max(savedGen.current, gen);
      setError(null);
      // A newer edit may still be debouncing — then keep showing "saving".
      if (!isPending()) setSaveState("saved");
    } catch (e) {
      // Left pending on purpose: the unmount flush retries once and the
      // tab-close guard warns — the edit really isn't saved.
      setSaveState("idle");
      setError(errorMessage(e, "Save failed."));
    }
  }

  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    if (cancelled.current) return;
    editGen.current += 1;
    setSaveState("saving");
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      void runSave();
    }, delayMs);
    return clearTimer;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  // Navigating away inside the debounce window would silently drop the last
  // edit (the deps-effect cleanup above clears the timer — that IS the
  // debounce). Flush it on unmount, fire-and-forget: the component is gone,
  // so there's no state left to update. A tab close still gets the browser's
  // are-you-sure prompt while anything is pending.
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (isPending()) e.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => {
      window.removeEventListener("beforeunload", warn);
      if (isPending()) {
        savedGen.current = editGen.current;
        void saveRef.current().catch(() => {});
      }
    };
    // isPending reads only refs — any render's copy behaves the same.
  }, []);

  /** Persist any pending edit now and wait for it. */
  async function flush() {
    clearTimer();
    if (isPending()) await runSave();
  }

  /** Hold pending and future saves — the record is about to be deleted. */
  function cancel() {
    cancelled.current = true;
    clearTimer();
  }

  /** Undo cancel() (the delete failed): save whatever is still pending. */
  function resume() {
    cancelled.current = false;
    if (isPending()) void runSave();
  }

  return { saveState, error, setError, flush, cancel, resume };
}
