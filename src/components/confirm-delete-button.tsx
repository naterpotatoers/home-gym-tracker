"use client";

import { useState } from "react";
import { TrashIcon } from "@/components/icons";
import { Button, ErrorText, IconButton } from "@/components/ui";
import { runAction } from "@/components/run-action";

/** Confirm-guarded trash button — weigh-in rows, planned-session discards,
 *  person/program deletes. Call sites pass a bound server action; a `label`
 *  renders a text button instead of the bare icon. Errors show inline. */
export function ConfirmDeleteButton({
  action,
  confirmText,
  ariaLabel,
  title,
  className = "ml-auto",
  label,
}: {
  action: () => Promise<void>;
  confirmText: string;
  ariaLabel: string;
  title?: string;
  className?: string;
  label?: string;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onClick() {
    if (!confirm(confirmText)) return;
    setBusy(true);
    setError(null);
    try {
      await runAction(action, setError, "Delete failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {error && <ErrorText>{error}</ErrorText>}
      {label ? (
        <Button
          variant="danger"
          size="sm"
          className={className}
          disabled={busy}
          onClick={onClick}
          title={title ?? ariaLabel}
          aria-label={ariaLabel}
        >
          <TrashIcon size={16} /> {label}
        </Button>
      ) : (
        <IconButton
          variant="ghost"
          className={className}
          disabled={busy}
          onClick={onClick}
          aria-label={ariaLabel}
          title={title ?? ariaLabel}
        >
          <TrashIcon />
        </IconButton>
      )}
    </>
  );
}
