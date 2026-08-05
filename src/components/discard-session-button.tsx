"use client";

import { useState } from "react";
import { TrashIcon } from "@/components/icons";
import { IconButton } from "@/components/ui";
import { discardSession } from "@/lib/actions/workout";

/** Confirm-guarded discard for a planned session. A planned session can hold
 *  real logged sets (status only flips on finish), so this never fires on a
 *  single tap. */
export function DiscardSessionButton({
  sessionId,
  label,
}: {
  sessionId: string;
  label: string;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <IconButton
      variant="ghost"
      size="sm"
      disabled={busy}
      className="ml-auto text-danger-text"
      onClick={async () => {
        if (!confirm(`Discard ${label}? Any sets already logged in it are deleted.`)) return;
        setBusy(true);
        try {
          await discardSession(sessionId);
        } finally {
          setBusy(false);
        }
      }}
      aria-label={`Discard ${label}`}
      title={`Discard ${label}`}
    >
      <TrashIcon />
    </IconButton>
  );
}
