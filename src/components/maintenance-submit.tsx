"use client";

import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui";

/** Submit button for the catalog-maintenance forms: shows a pending label
 *  while the server action runs, and optionally confirms first (Re-sync
 *  overwrites edited muscle scores). */
export function MaintenanceSubmit({
  label,
  pendingLabel,
  confirmText,
  variant = "secondary",
}: {
  label: string;
  pendingLabel: string;
  confirmText?: string;
  variant?: "primary" | "secondary";
}) {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      size="sm"
      variant={variant}
      disabled={pending}
      onClick={(e) => {
        if (confirmText && !window.confirm(confirmText)) e.preventDefault();
      }}
    >
      {pending ? pendingLabel : label}
    </Button>
  );
}
