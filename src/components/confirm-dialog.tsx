"use client";

import { useId } from "react";
import { Dialog } from "@/components/dialog";
import { Button } from "@/components/ui";

/**
 * In-app "are you sure?" for destructive actions — a sheet with big Cancel /
 * confirm buttons instead of the browser's confirm() (which is easy to miss
 * on an iPad and can't be styled or read aloud as part of the app). Cancel
 * gets focus, so a stray Enter never deletes anything.
 */
export function ConfirmDialog({
  title,
  body,
  confirmLabel,
  onConfirm,
  onClose,
}: {
  title: string;
  body?: string;
  confirmLabel: string;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const titleId = useId();
  return (
    <Dialog labelledBy={titleId} placement="sheet" onClose={onClose}>
      <h2 id={titleId} className="text-lg font-semibold">
        {title}
      </h2>
      {body && <p className="mt-1 text-sm text-muted">{body}</p>}
      <div className="mt-4 flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose} autoFocus>
          Cancel
        </Button>
        <Button
          variant="danger"
          onClick={() => {
            onClose();
            onConfirm();
          }}
        >
          {confirmLabel}
        </Button>
      </div>
    </Dialog>
  );
}
