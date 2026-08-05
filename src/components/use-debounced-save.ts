"use client";

import { useEffect, useRef, useState } from "react";
import { errorMessage } from "@/lib/format";

/**
 * Debounced autosave: run `save` ~1s after the last change to `deps`,
 * skipping the initial render. Returns the shared saving/saved/error state
 * the header status lines render.
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
  /** True while an edit is debouncing or its save is in flight — consulted by
   *  the unmount flush and the tab-close guard so no edit is silently lost. */
  const pendingRef = useRef(false);

  // Latest-ref pattern: the debounce timer always calls the newest save
  // closure without retriggering on every render.
  useEffect(() => {
    saveRef.current = save;
  });

  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    setSaveState("saving");
    pendingRef.current = true;
    const timer = setTimeout(async () => {
      try {
        await saveRef.current();
        pendingRef.current = false;
        setSaveState("saved");
        setError(null);
      } catch (e) {
        pendingRef.current = false;
        setSaveState("idle");
        setError(errorMessage(e, "Save failed."));
      }
    }, delayMs);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  // Navigating away inside the debounce window would silently drop the last
  // edit (the deps-effect cleanup above clears the timer — that IS the
  // debounce). Flush it on unmount, fire-and-forget: the component is gone,
  // so there's no state left to update. A tab close still gets the browser's
  // are-you-sure prompt while anything is pending.
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (pendingRef.current) e.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => {
      window.removeEventListener("beforeunload", warn);
      if (pendingRef.current) {
        pendingRef.current = false;
        void saveRef.current().catch(() => {});
      }
    };
  }, []);

  return { saveState, error, setError };
}
