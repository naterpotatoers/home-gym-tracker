"use client";

import { useState } from "react";
import { TrashIcon } from "@/components/icons";
import { IconButton } from "@/components/ui";
import { deleteWeighIn } from "@/lib/actions/weigh-ins";

/** Confirm-guarded delete for one weigh-in row on the Tracking tab. */
export function DeleteWeighInButton({
  weighInId,
  label,
}: {
  weighInId: string;
  label: string;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <IconButton
      variant="ghost"
      size="sm"
      className="ml-auto"
      disabled={busy}
      onClick={async () => {
        if (!confirm(`Delete the ${label} weigh-in?`)) return;
        setBusy(true);
        try {
          await deleteWeighIn(weighInId);
        } finally {
          setBusy(false);
        }
      }}
      aria-label={`Delete weigh-in: ${label}`}
      title="Delete weigh-in"
    >
      <TrashIcon />
    </IconButton>
  );
}
