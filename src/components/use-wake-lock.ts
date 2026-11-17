"use client";

import { useEffect } from "react";

/**
 * Keep the screen awake while a live session page is open — a propped-up iPad
 * sleeping between sets is the whole failure mode. Feature-detected: the Wake
 * Lock API only exists in secure contexts (https/localhost), so over plain-http
 * LAN this is a silent no-op. Re-acquires when the tab becomes visible again
 * (the browser releases the lock on hide).
 */
export function useWakeLock() {
  useEffect(() => {
    if (!("wakeLock" in navigator)) return;
    let lock: WakeLockSentinel | null = null;
    // A request still in flight at unmount resolves after cleanup ran —
    // release that late lock instead of keeping the screen on forever.
    let cancelled = false;

    async function acquire() {
      try {
        const next = await navigator.wakeLock.request("screen");
        if (cancelled) {
          next.release().catch(() => {});
          return;
        }
        lock = next;
      } catch {
        // Denied (battery saver, hidden tab) — nothing useful to do.
      }
    }

    void acquire();
    const onVisibility = () => {
      if (document.visibilityState === "visible") void acquire();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisibility);
      lock?.release().catch(() => {});
    };
  }, []);
}
