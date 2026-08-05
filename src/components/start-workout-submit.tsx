"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { PlayIcon } from "@/components/icons";
import { Button } from "@/components/ui";

/**
 * Submit for the start-workout form: disabled while the action runs (a slow
 * LAN double-tap would otherwise create duplicate planned sessions) and
 * guarded client-side so "nobody checked" is an inline note instead of the
 * error boundary. The server action's own throw stays as the backstop.
 */
export function StartWorkoutSubmit() {
  const { pending } = useFormStatus();
  const [warning, setWarning] = useState<string | null>(null);

  return (
    <span className="flex flex-wrap items-center gap-3">
      <Button
        type="submit"
        variant="primary"
        disabled={pending}
        onClick={(e) => {
          const form = e.currentTarget.form;
          const anyChecked =
            form &&
            [...form.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')].some(
              (box) => box.name.startsWith("include_") && box.checked,
            );
          if (!anyChecked) {
            e.preventDefault();
            setWarning("Pick at least one client first.");
          } else {
            setWarning(null);
          }
        }}
      >
        {pending ? "Starting…" : <><PlayIcon size={16} /> Start workout</>}
      </Button>
      {warning && (
        <span className="text-sm font-semibold text-warning-text">{warning}</span>
      )}
    </span>
  );
}
