"use client";

import { useState } from "react";
import { TrashIcon } from "@/components/icons";
import { IconButton } from "@/components/ui";

/** Confirm-guarded trash button — weigh-in rows, planned-session discards,
 *  person deletes. Call sites pass a bound server action. */
export function ConfirmDeleteButton({
  action,
  confirmText,
  ariaLabel,
  title,
  className = "ml-auto",
}: {
  action: () => Promise<void>;
  confirmText: string;
  ariaLabel: string;
  title?: string;
  className?: string;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <IconButton
      variant="ghost"
      size="sm"
      className={className}
      disabled={busy}
      onClick={async () => {
        if (!confirm(confirmText)) return;
        setBusy(true);
        try {
          await action();
        } finally {
          setBusy(false);
        }
      }}
      aria-label={ariaLabel}
      title={title ?? ariaLabel}
    >
      <TrashIcon />
    </IconButton>
  );
}
