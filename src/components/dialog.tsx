"use client";

import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import { useEscape } from "@/components/use-escape";

/** Where the panel sits: centered near the top (full-screen on phones), a
 *  bottom sheet on phones that centers from sm:, or a right-hand side panel. */
type Placement = "center" | "sheet" | "side";

const SCRIM: Record<Placement, string> = {
  center: "flex items-start justify-center sm:p-4 sm:pt-16",
  sheet: "flex items-end justify-center sm:items-start sm:p-4 sm:pt-16",
  side: "flex justify-end",
};

const PANEL: Record<Placement, string> = {
  center:
    "h-dvh w-full overflow-y-auto bg-surface p-4 sm:h-auto sm:max-h-[80vh] sm:max-w-lg sm:rounded-xl sm:border sm:border-border sm:shadow-xl",
  sheet:
    "max-h-[90dvh] w-full overflow-y-auto rounded-t-2xl border border-border bg-surface p-4 shadow-xl sm:max-w-md sm:rounded-xl",
  side: "flex h-dvh w-full max-w-md flex-col overflow-y-auto border-l border-border bg-surface p-4",
};

/**
 * The app's modal overlay: portaled to <body> (no ancestor stacking context
 * — a board card's transform, say — can trap the fixed overlay), a scrim
 * that closes on click, Escape to close, and the dialog semantics. Callers
 * render their own header and Close button inside.
 */
export function Dialog({
  label,
  labelledBy,
  placement = "center",
  onClose,
  children,
}: {
  /** Accessible name, unless `labelledBy` points at a visible heading. */
  label?: string;
  labelledBy?: string;
  placement?: Placement;
  onClose: () => void;
  children: ReactNode;
}) {
  useEscape(onClose);
  return createPortal(
    <div className={`fixed inset-0 z-50 bg-scrim ${SCRIM[placement]}`} onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={labelledBy ? undefined : label}
        aria-labelledby={labelledBy}
        className={PANEL[placement]}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>,
    document.body,
  );
}
