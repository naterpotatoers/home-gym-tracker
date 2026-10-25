"use client";

import { useState, useTransition } from "react";
import { ConfirmDeleteButton } from "@/components/confirm-delete-button";
import { PlusIcon } from "@/components/icons";
import { Button, ColorDot, ErrorText, Input, Select } from "@/components/ui";
import {
  createAssignment,
  deleteAssignment,
  updateAssignmentStatus,
} from "@/lib/actions/programs";
import { errorMessage } from "@/lib/format";
import type { Assignment } from "@/lib/types";

export type AssignmentChip = Assignment & { firstName: string; color: string | null };

/**
 * Who's on this program, under the editor header. Status saves the moment it
 * changes; assigning someone already on a program completes their old one
 * (createAssignment keeps one active program per person).
 */
export function AssignmentChips({
  programId,
  assignments,
  clients,
  defaultStartDate,
}: {
  programId: string;
  assignments: AssignmentChip[];
  clients: { id: string; firstName: string }[];
  /** This week's Monday — the schema's week starts Monday. */
  defaultStartDate: string;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function run(action: () => Promise<void>) {
    setError(null);
    startTransition(async () => {
      try {
        await action();
      } catch (e) {
        setError(errorMessage(e, "Update failed."));
      }
    });
  }

  return (
    <div className="mt-4">
      <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">
        Assigned to
      </h2>
      <ul className="flex flex-wrap gap-2">
        {assignments.map((a) => (
          <li
            key={a.id}
            className={`flex items-center gap-2 rounded-xl border border-border bg-surface py-1 pl-3 pr-1 text-sm ${
              a.status === "active" ? "" : "text-muted"
            }`}
          >
            <ColorDot color={a.color} />
            <span className="font-semibold">{a.firstName}</span>
            <span className="font-mono text-xs text-muted">from {a.startDate}</span>
            <Select
              size="sm"
              value={a.status}
              disabled={pending}
              onChange={(e) => {
                const status = e.target.value;
                run(() => updateAssignmentStatus(a.id, status));
              }}
              aria-label={`${a.firstName}'s status`}
            >
              <option value="active">active</option>
              <option value="paused">paused</option>
              <option value="completed">completed</option>
            </Select>
            <ConfirmDeleteButton
              action={() => deleteAssignment(a.id)}
              confirmText={`Remove ${a.firstName} from this program?`}
              ariaLabel={`Remove ${a.firstName}'s assignment`}
              className=""
            />
          </li>
        ))}
        {assignments.length === 0 && (
          <li className="text-sm text-muted">Nobody yet.</li>
        )}
      </ul>

      <form
        action={(formData) => run(() => createAssignment(formData))}
        className="mt-2 flex flex-wrap items-center gap-2"
      >
        <input type="hidden" name="programId" value={programId} />
        <Select name="clientId" size="sm" aria-label="Person to assign">
          {clients.map((client) => (
            <option key={client.id} value={client.id}>
              {client.firstName}
            </option>
          ))}
        </Select>
        <Input
          type="date"
          name="startDate"
          required
          size="sm"
          defaultValue={defaultStartDate}
          aria-label="Start date"
        />
        <Button type="submit" size="sm" disabled={pending}>
          <PlusIcon size={16} /> Assign
        </Button>
      </form>
      {error && <ErrorText>{error}</ErrorText>}
    </div>
  );
}
