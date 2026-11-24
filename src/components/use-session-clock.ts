"use client";

import { useEffect, useState } from "react";
import { CLOCK_PREFIX, inheritedStart, isFreshStart, staleKeys } from "@/lib/session-clock";

/** Every stored entry — for inheriting a board's start and pruning. */
function storedEntries(): [string, string | null][] {
  const out: [string, string | null][] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key !== null) out.push([key, localStorage.getItem(key)]);
  }
  return out;
}

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
    const key = `${CLOCK_PREFIX}${storageKey}`;
    let t0 = Date.now();
    try {
      // Housekeeping first: leftover clocks and snapshots from old sessions.
      for (const stale of staleKeys(storedEntries(), t0)) localStorage.removeItem(stale);
      const stored = Number(localStorage.getItem(key));
      // A solo runner for someone already on a board keeps the board's time.
      t0 = isFreshStart(stored, t0) ? stored : (inheritedStart(storedEntries(), storageKey, t0) ?? t0);
      localStorage.setItem(key, String(t0));
    } catch {
      // No storage: the clock just starts now.
    }
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
    try {
      localStorage.removeItem(`${CLOCK_PREFIX}${storageKey}`);
    } catch {
      // nothing stored
    }
  }

  return { now, startedAt, elapsedMinutes, clear };
}
