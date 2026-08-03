"use client";

import { useEffect, useRef, useState } from "react";

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
    const timer = setTimeout(async () => {
      try {
        await saveRef.current();
        setSaveState("saved");
        setError(null);
      } catch (e) {
        setSaveState("idle");
        setError(e instanceof Error ? e.message : "Save failed.");
      }
    }, delayMs);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { saveState, error, setError };
}
