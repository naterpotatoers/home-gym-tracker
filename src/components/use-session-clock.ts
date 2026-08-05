"use client";

import { useEffect, useState } from "react";

/** A clock start older than this is a leftover from an abandoned day, not a
 *  workout still in progress — restart rather than showing "437 min". */
const STALE_MS = 12 * 60 * 60 * 1000;

/**
 * Ticking session clock whose start time survives reloads and tab evictions
 * via localStorage (Safari regularly evicts backgrounded iPad tabs). Key it
 * by session id (solo) or the joined session ids (board); call `clear()` on
 * finish/discard so the next session starts fresh.
 */
export function useSessionClock(storageKey: string) {
  const [now, setNow] = useState(0);
  const [startedAt, setStartedAt] = useState(0);

  useEffect(() => {
    const key = `workout-start-${storageKey}`;
    const stored = Number(localStorage.getItem(key));
    const fresh = Number.isFinite(stored) && stored > 0 && Date.now() - stored < STALE_MS;
    const t0 = fresh ? stored : Date.now();
    localStorage.setItem(key, String(t0));
    // State updates happen only inside timer callbacks (never synchronously in
    // the effect body) to satisfy the React Compiler's effect rules; the
    // zero-delay kick populates the clock right after mount.
    const tick = () => {
      setStartedAt(t0);
      setNow(Date.now());
    };
    const kick = setTimeout(tick, 0);
    const timer = setInterval(tick, 1000);
    return () => {
      clearTimeout(kick);
      clearInterval(timer);
    };
  }, [storageKey]);

  const elapsedMinutes =
    startedAt > 0 && now > startedAt ? Math.floor((now - startedAt) / 60_000) : 0;

  function clear() {
    localStorage.removeItem(`workout-start-${storageKey}`);
  }

  return { now, startedAt, elapsedMinutes, clear };
}
