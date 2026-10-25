"use client";

import Link from "next/link";
import { unstable_rethrow } from "next/navigation";
import { useState, useTransition } from "react";
import { ArrowLeftIcon, CopyIcon, PlusIcon, TrashIcon } from "@/components/icons";
import { OverflowMenu } from "@/components/overflow-menu";
import { useDebouncedSave } from "@/components/use-debounced-save";
import { Button, Card, chipClass, ErrorText, Input, Select } from "@/components/ui";
import {
  addWeek,
  clearProgramDay,
  deleteProgram,
  duplicateProgram,
  duplicateWeek,
  removeWeek,
  setProgramDay,
  updateProgramInfo,
} from "@/lib/actions/programs";
import type { Program, ProgramDay, Routine } from "@/lib/types";
import { errorMessage } from "@/lib/format";
import { DAY_LABELS } from "@/lib/periods";
import { MAX_PROGRAM_WEEKS } from "@/lib/validate";


/**
 * Editable program header + week rows. Weeks are managed structurally —
 * duplicate/remove per row, add an empty one at the bottom — and the header autosaves,
 * so there is no weeks-number-plus-Save dance. md+ renders the classic grid
 * table; below md each week is a card of stacked day rows. Both share
 * dayCell so the handlers can't fork.
 */
export function ProgramEditor({
  program,
  days,
  routines,
}: {
  program: Program;
  days: ProgramDay[];
  routines: Routine[];
}) {
  const [name, setName] = useState(program.name);
  const [notes, setNotes] = useState(program.notes);
  const [pending, startTransition] = useTransition();

  // Debounced header autosave — name/notes persist ~1s after the last keystroke.
  const { saveState, error, setError } = useDebouncedSave(
    [name, notes, program.id],
    () => updateProgramInfo(program.id, { name, notes }),
  );

  // Day cells save one at a time without locking the grid: each change shows
  // immediately (optimistic) and only that cell disables while it saves.
  const [optimistic, setOptimistic] = useState<ReadonlyMap<string, string>>(new Map());
  const [savingCells, setSavingCells] = useState<ReadonlySet<string>>(new Set());
  // Fresh server days supersede the overrides of cells no longer saving.
  const [seenDays, setSeenDays] = useState(days);
  if (seenDays !== days) {
    setSeenDays(days);
    setOptimistic((prev) => new Map([...prev].filter(([key]) => savingCells.has(key))));
  }

  const byCell = new Map(days.map((d) => [`${d.week}|${d.dayOfWeek}`, d.routineId]));
  for (const [key, routineId] of optimistic) byCell.set(key, routineId);
  const sorted = [...routines].sort((a, b) => a.name.localeCompare(b.name));
  const weekNumbers = Array.from({ length: program.weeks }, (_, i) => i + 1);

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

  async function saveCell(week: number, dayOfWeek: number, routineId: string) {
    const key = `${week}|${dayOfWeek}`;
    setError(null);
    setOptimistic((prev) => new Map(prev).set(key, routineId));
    setSavingCells((prev) => new Set(prev).add(key));
    try {
      await (routineId
        ? setProgramDay(program.id, week, dayOfWeek, routineId)
        : clearProgramDay(program.id, week, dayOfWeek));
    } catch (e) {
      setError(errorMessage(e, "Update failed."));
      setOptimistic((prev) => {
        const next = new Map(prev);
        next.delete(key);
        return next;
      });
    } finally {
      setSavingCells((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    }
  }

  // Both redirect on success — let that signal through, report anything else.
  async function handleDuplicateProgram() {
    setError(null);
    try {
      await duplicateProgram(program.id);
    } catch (e) {
      unstable_rethrow(e);
      setError(errorMessage(e, "Duplicate failed."));
    }
  }

  async function handleDeleteProgram() {
    if (!confirm(`Delete ${program.name}? This can't be undone.`)) return;
    setError(null);
    try {
      await deleteProgram(program.id);
    } catch (e) {
      unstable_rethrow(e);
      setError(errorMessage(e, "Delete failed."));
    }
  }

  function confirmRemove(week: number) {
    if (!confirm(`Remove week ${week}? Later weeks shift up.`)) return;
    run(() => removeWeek(program.id, week));
  }

  // Render helpers, called as functions — NOT components. A component defined
  // inside this render is a new type every render, so React would remount
  // every select (dropping focus/open dropdowns) on each keystroke.
  function dayCell({
    week,
    dayOfWeek,
    size,
    className = "",
  }: {
    week: number;
    dayOfWeek: number;
    size: "sm" | "md";
    className?: string;
  }) {
    const key = `${week}|${dayOfWeek}`;
    const value = byCell.get(key) ?? "";
    return (
      <Select
        size={size}
        value={value}
        // Structural edits renumber weeks, so cells wait those out.
        disabled={pending || savingCells.has(key)}
        onChange={(e) => void saveCell(week, dayOfWeek, e.target.value)}
        aria-label={`Week ${week} ${DAY_LABELS[dayOfWeek - 1]}`}
        className={`${value ? "" : "text-muted"} ${className}`}
      >
        <option value="">—</option>
        {sorted.map((routine) => (
          <option key={routine.id} value={routine.id}>
            {routine.name}
          </option>
        ))}
      </Select>
    );
  }

  function weekActions(week: number) {
    return (
      <OverflowMenu
        label={`Week ${week} actions`}
        size="md"
        items={[
          {
            label: "Duplicate week",
            icon: <CopyIcon size={16} />,
            onSelect: () => run(() => duplicateWeek(program.id, week)),
            disabled: pending || program.weeks >= MAX_PROGRAM_WEEKS,
          },
          {
            label: "Remove week",
            icon: <TrashIcon size={16} />,
            onSelect: () => confirmRemove(week),
            disabled: pending || program.weeks <= 1,
            danger: true,
          },
        ]}
      />
    );
  }

  return (
    <div>
      <Link
        href="/programs"
        className={chipClass(false, "min-h-9 pointer-coarse:min-h-11 px-2.5 text-xs")}
      >
        <ArrowLeftIcon size={14} /> Plan
      </Link>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          aria-label="Program name"
          className="min-w-0 flex-[3] basis-72 font-semibold"
        />
        <Input
          type="text"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Notes"
          aria-label="Program notes"
          className="min-w-0 flex-[2] basis-56"
        />
        <span className="text-xs text-muted">
          {program.weeks} {program.weeks === 1 ? "week" : "weeks"}
          {saveState === "saving" && " · saving…"}
          {saveState === "saved" && " · saved"}
        </span>
        <OverflowMenu
          label="Program actions"
          size="md"
          items={[
            { label: "Duplicate program", icon: <CopyIcon size={16} />, onSelect: handleDuplicateProgram },
            { label: "Delete program", icon: <TrashIcon size={16} />, onSelect: handleDeleteProgram, danger: true },
          ]}
        />
        {error && <ErrorText>{error}</ErrorText>}
      </div>

      {/* md+: the weeks × days grid */}
      <div className="mt-6 hidden overflow-x-auto md:block">
        <table className="w-full min-w-[44rem] text-sm">
          <thead>
            <tr className="border-b border-border text-left">
              <th className="py-1.5 pr-3 text-xs font-semibold uppercase tracking-wide text-muted">
                Week
              </th>
              {DAY_LABELS.map((label) => (
                <th
                  key={label}
                  className="py-1.5 pr-2 text-xs font-semibold uppercase tracking-wide text-muted"
                >
                  {label}
                </th>
              ))}
              <th />
            </tr>
          </thead>
          <tbody>
            {weekNumbers.map((week) => (
              <tr key={week} className="border-b border-border">
                <td className="py-1.5 pr-3 font-mono text-xs text-muted">{week}</td>
                {DAY_LABELS.map((_, dayIndex) => (
                  <td key={dayIndex + 1} className="py-1 pr-2">
                    {dayCell({
                      week,
                      dayOfWeek: dayIndex + 1,
                      size: "sm",
                      className: "w-full max-w-32",
                    })}
                  </td>
                ))}
                <td className="py-1 text-right">
                  {weekActions(week)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* below md: a card per week */}
      <div className="mt-6 space-y-3 md:hidden">
        {weekNumbers.map((week) => (
          <Card key={week}>
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm font-semibold">Week {week}</span>
              {weekActions(week)}
            </div>
            <div className="space-y-2">
              {DAY_LABELS.map((label, dayIndex) => (
                <div key={label} className="grid grid-cols-[3rem_1fr] items-center gap-2">
                  <span className="text-xs text-muted">{label}</span>
                  {dayCell({ week, dayOfWeek: dayIndex + 1, size: "md", className: "w-full" })}
                </div>
              ))}
            </div>
          </Card>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <Button
          disabled={pending || program.weeks >= MAX_PROGRAM_WEEKS}
          onClick={() => run(() => addWeek(program.id))}
        >
          <PlusIcon size={16} /> Add empty week
        </Button>
      </div>
    </div>
  );
}
