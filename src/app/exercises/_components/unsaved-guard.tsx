"use client";

import Link from "next/link";
import { createContext, useContext, useEffect, useRef } from "react";

/**
 * Shared "the editor has unsaved changes" flag for /exercises. The editor is
 * keyed by exercise id, so following a sidebar link would silently discard
 * its state — links read this flag at click time and confirm first. A ref,
 * not state: nothing needs to re-render when it flips.
 */
const DirtyContext = createContext<{ current: boolean } | null>(null);

const DISCARD_PROMPT = "You have unsaved changes to this exercise. Discard them?";

export function UnsavedGuardProvider({ children }: { children: React.ReactNode }) {
  const dirtyRef = useRef(false);
  return <DirtyContext.Provider value={dirtyRef}>{children}</DirtyContext.Provider>;
}

/** Publish the editor's dirty state: feeds the link guard and arms a
 *  beforeunload warning (reload, tab close, external navigation). */
export function useUnsavedGuard(isDirty: boolean) {
  const dirtyRef = useContext(DirtyContext);
  useEffect(() => {
    if (dirtyRef) dirtyRef.current = isDirty;
    if (!isDirty) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => {
      window.removeEventListener("beforeunload", warn);
      if (dirtyRef) dirtyRef.current = false;
    };
  }, [dirtyRef, isDirty]);
}

/** next/link that confirms before leaving an editor with unsaved changes. */
export function GuardedLink(props: React.ComponentProps<typeof Link>) {
  const dirtyRef = useContext(DirtyContext);
  const { onClick, ...rest } = props;
  return (
    <Link
      {...rest}
      onClick={(e) => {
        if (dirtyRef?.current && !window.confirm(DISCARD_PROMPT)) {
          e.preventDefault();
          return;
        }
        onClick?.(e);
      }}
    />
  );
}
