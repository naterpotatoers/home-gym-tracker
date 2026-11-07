"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useFormStatus } from "react-dom";
import { ConfirmDeleteButton } from "@/components/confirm-delete-button";
import { CalendarIcon, CheckIcon, PlayIcon } from "@/components/icons";
import { Button, Checkbox, ColorDot, Select } from "@/components/ui";
import { startGroupFromForm } from "@/lib/actions/group";
import { restartAssignment, updateAssignmentStatus } from "@/lib/actions/programs";
import { errorMessage } from "@/lib/format";
import { discardSession } from "@/lib/actions/workout";

/** One person on the launcher — plain data only (it crosses the server →
 *  client boundary). Option values are what startGroupFromForm parses:
 *  `resume:<sessionId>` or `<routineId>|<assignmentId-or-empty>`. */
export type LauncherRow = {
  clientId: string;
  firstName: string;
  color: string | null;
  /** `group` becomes an <optgroup>; options arrive already in group order. */
  options: { value: string; label: string; group: string }[];
  defaultPlan: string;
  defaultChecked: boolean;
  unfinished: { id: string; name: string; date: string }[];
  /** The active program has run its length — prompt instead of serving it. */
  finishedProgram: { assignmentId: string; programName: string } | null;
};

/** Consecutive runs of options sharing a group label, in order. */
function grouped(options: LauncherRow["options"]) {
  const out: { group: string; options: LauncherRow["options"] }[] = [];
  for (const option of options) {
    const last = out.at(-1);
    if (last && last.group === option.group) last.options.push(option);
    else out.push({ group: option.group, options: [option] });
  }
  return out;
}

/**
 * Tap who's training, confirm their plan, one Start. The button names what
 * it will do — "Start Nate's workout", "Resume…", "Start group workout (2)" —
 * so there is exactly one way in.
 */
export function WorkoutLauncher({ rows }: { rows: LauncherRow[] }) {
  const [checked, setChecked] = useState<ReadonlySet<string>>(
    () => new Set(rows.filter((r) => r.defaultChecked).map((r) => r.clientId)),
  );
  const [plans, setPlans] = useState<Record<string, string>>(() =>
    Object.fromEntries(rows.map((r) => [r.clientId, r.defaultPlan])),
  );

  function toggle(clientId: string, on: boolean) {
    setChecked((prev) => {
      const next = new Set(prev);
      if (on) next.add(clientId);
      else next.delete(clientId);
      return next;
    });
  }

  const selected = rows.filter((r) => checked.has(r.clientId));
  const label =
    selected.length === 0
      ? "Pick who's training"
      : selected.length === 1
        ? `${plans[selected[0].clientId]?.startsWith("resume:") ? "Resume" : "Start"} ${selected[0].firstName}'s workout`
        : `Start group workout (${selected.length})`;

  return (
    <form action={startGroupFromForm} className="mt-6">
      {/* One row per person — name, plan and Program link on one line at
          sm+ (the plan drops below the name on phones). The left edge wears
          the client's color; the selected rows get the accent wash. */}
      <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface">
        {rows.map((row) => {
          const on = checked.has(row.clientId);
          return (
            <li
              key={row.clientId}
              className={`border-l-4 px-3 py-1.5 transition-colors ${on ? "bg-accent-soft" : ""}`}
              style={{ borderLeftColor: row.color ?? "transparent" }}
            >
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <label className="flex min-h-11 min-w-0 flex-1 cursor-pointer items-center gap-3">
                  <Checkbox
                    name={`include_${row.clientId}`}
                    checked={on}
                    onChange={(e) => toggle(row.clientId, e.target.checked)}
                  />
                  <ColorDot color={row.color} size="md" />
                  <span className="truncate text-base font-semibold">{row.firstName}</span>
                </label>
                <Select
                  name={`plan_${row.clientId}`}
                  value={plans[row.clientId]}
                  onChange={(e) => {
                    const value = e.target.value;
                    setPlans((prev) => ({ ...prev, [row.clientId]: value }));
                    // Picking a plan means this person is training.
                    toggle(row.clientId, true);
                  }}
                  aria-label={`${row.firstName}'s plan`}
                  className="order-last w-full sm:order-none sm:w-64"
                >
                  {grouped(row.options).map(({ group, options }) => (
                    <optgroup key={group} label={group}>
                      {options.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </Select>
                <Link
                  href={`/workout/${row.clientId}`}
                  className="inline-flex min-h-11 items-center gap-1.5 rounded-md px-2 text-xs text-muted hover:bg-current/5 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
                >
                  <CalendarIcon size={14} /> Program
                </Link>
              </div>

              {row.finishedProgram && (
                <ProgramFinished {...row.finishedProgram} />
              )}

              {row.unfinished.map((s) => (
                <div key={s.id} className="mt-1 flex items-center gap-2 text-xs text-muted">
                  <span className="truncate">
                    Unfinished: {s.name} <span className="font-mono">({s.date})</span>
                  </span>
                  <ConfirmDeleteButton
                    action={discardSession.bind(null, s.id)}
                    confirmText={`Discard ${s.name} (${s.date})? Any sets already logged in it are deleted.`}
                    ariaLabel={`Discard ${s.name} (${s.date})`}
                    className="ml-auto text-danger-text"
                  />
                </div>
              ))}
            </li>
          );
        })}
      </ul>

      {/* Start stays reachable however long the roster gets — pinned above
          the phone tab bar, to the viewport bottom on md+. */}
      <div className="sticky bottom-16 z-10 -mx-4 mt-3 bg-background/90 px-4 py-2 backdrop-blur md:bottom-0 sm:-mx-6 sm:px-6">
        <StartButton label={label} disabled={selected.length === 0} />
      </div>
    </form>
  );
}

/** A program that has run its length: finish it, run it again, or pick
 *  another. Plain buttons (not submits) — they sit inside the Start form. */
function ProgramFinished({
  assignmentId,
  programName,
}: {
  assignmentId: string;
  programName: string;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const act = (fn: () => Promise<void>) =>
    startTransition(async () => {
      try {
        setError(null);
        await fn();
      } catch (e) {
        setError(errorMessage(e, "Couldn't update the program."));
      }
    });
  return (
    <div className="mt-1 mb-1 rounded-lg border border-success/40 bg-success/10 px-3 py-2 text-sm">
      <p>
        <span className="font-semibold text-success-text">
          <span className="mr-1 inline-block align-[-2px]">
            <CheckIcon size={14} />
          </span>
          Program finished:
        </span>{" "}
        {programName}
      </p>
      <div className="mt-1 flex flex-wrap items-center gap-1">
        <Button
          type="button"
          size="sm"
          variant="secondary"
          disabled={pending}
          onClick={() => act(() => updateAssignmentStatus(assignmentId, "completed"))}
        >
          Mark complete
        </Button>
        <Button
          type="button"
          size="sm"
          variant="secondary"
          disabled={pending}
          onClick={() => act(() => restartAssignment(assignmentId))}
        >
          Restart from week 1
        </Button>
        <Link
          href="/programs"
          className="inline-flex min-h-9 items-center rounded-md px-2 text-sm text-accent-text underline-offset-2 hover:underline pointer-coarse:min-h-11 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
        >
          Pick another
        </Link>
      </div>
      {error && <p className="mt-1 text-xs text-danger-text">{error}</p>}
    </div>
  );
}

/** Disabled while the action runs — a slow LAN double-tap would otherwise
 *  create duplicate planned sessions. */
function StartButton({ label, disabled }: { label: string; disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="primary" disabled={disabled || pending} className="w-full sm:w-auto">
      {pending ? "Starting…" : <><PlayIcon size={16} /> {label}</>}
    </Button>
  );
}
