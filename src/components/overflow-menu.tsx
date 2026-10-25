"use client";

import { useEffect, useRef, useState } from "react";
import { MoreIcon } from "@/components/icons";
import { IconButton } from "@/components/ui";

export type OverflowItem = {
  label: string;
  icon?: React.ReactNode;
  onSelect: () => void;
  /** Destructive — danger text, listed last by convention. */
  danger?: boolean;
  /** Shown but inert — e.g. "Move up" on the first row. */
  disabled?: boolean;
};

/**
 * "⋯" button + small popover menu for an item's secondary actions (swap,
 * remove, warm-up toggle, delete), so rare and destructive actions stay off
 * the main surface and out of stray-tap range. Closes on outside tap/Escape.
 */
export function OverflowMenu({
  items,
  label,
  size = "sm",
}: {
  items: OverflowItem[];
  /** Accessible name — "Set 2 actions", "Squat actions". */
  label: string;
  size?: "sm" | "md";
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative shrink-0">
      <IconButton
        variant="ghost"
        size={size}
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={label}
        title={label}
      >
        <MoreIcon />
      </IconButton>
      {open && (
        <ul
          role="menu"
          aria-label={label}
          className="absolute right-0 top-full z-30 mt-1 min-w-48 overflow-hidden rounded-lg border border-border-strong bg-surface py-1 shadow-[0_8px_24px_-8px_var(--shadow)]"
        >
          {items.map((item) => (
            <li key={item.label} role="none">
              <button
                type="button"
                role="menuitem"
                disabled={item.disabled}
                onClick={() => {
                  setOpen(false);
                  item.onSelect();
                }}
                className={`flex min-h-11 w-full cursor-pointer items-center gap-2 px-3 text-left text-sm hover:bg-current/5 disabled:cursor-default disabled:opacity-40 disabled:hover:bg-transparent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent/60 ${
                  item.danger ? "text-danger-text" : ""
                }`}
              >
                {item.icon}
                {item.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
