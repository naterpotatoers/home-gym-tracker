"use client";

import { useState } from "react";
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
    <button
      type="button"
      disabled={busy}
      onClick={async () => {
        if (!confirm(`Discard ${label}? Any sets already logged in it are deleted.`)) return;
        setBusy(true);
        try {
          await discardSession(sessionId);
        } finally {
          setBusy(false);
        }
      }}
      className="cursor-pointer whitespace-nowrap text-xs text-danger-text underline underline-offset-2 disabled:opacity-50"
    >
      {busy ? "discarding…" : "discard"}
    </button>
  );
}
