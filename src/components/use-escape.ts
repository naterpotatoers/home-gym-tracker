"use client";

import { useEffect, useRef } from "react";

/** Close-on-Escape for overlays (picker, side sheet, overflow menu). Pass null
 *  while the overlay is closed. The latest callback is always the one called,
 *  so callers can pass an inline arrow without re-subscribing every render. */
export function useEscape(onEscape: (() => void) | null): void {
  const latest = useRef(onEscape);
  useEffect(() => {
    latest.current = onEscape;
  });
  const active = onEscape !== null;
  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") latest.current?.();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [active]);
}
