"use client";

import { useState, useTransition } from "react";
import { Button, Card, Input, Select } from "@/components/ui";
import {
  clearProgramDay,
  copyWeekToAll,
  setProgramDay,
  updateProgramMeta,
} from "@/lib/actions/programs";
import type { Program, ProgramDay, Routine } from "@/lib/types";

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/** Editable program header + the weeks × days grid of routine selects.
 *  md+ renders the classic grid table; below md each week is a card of
 *  stacked day rows. Both share DayCell so the handlers can't fork. */
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
  const [weeks, setWeeks] = useState(program.weeks);
  const [notes, setNotes] = useState(program.notes);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const byCell = new Map(days.map((d) => [`${d.week}|${d.dayOfWeek}`, d.routineId]));
  const sorted = [...routines].sort((a, b) => a.name.localeCompare(b.name));
  const weekNumbers = Array.from({ length: program.weeks }, (_, i) => i + 1);

  function run(action: () => Promise<void>) {
    setError(null);
    startTransition(async () => {
      try {
        await action();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Update failed.");
      }
    });
  }

  function DayCell({
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
    const value = byCell.get(`${week}|${dayOfWeek}`) ?? "";
    return (
      <Select
        size={size}
        value={value}
        disabled={pending}
        onChange={(e) => {
          const routineId = e.target.value;
          run(() =>
            routineId
              ? setProgramDay(program.id, week, dayOfWeek, routineId)
              : clearProgramDay(program.id, week, dayOfWeek),
          );
        }}
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

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3">
        <Input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="min-w-64 text-xl font-bold tracking-tight"
        />
        <label className="flex items-center gap-1 text-sm">
          <Input
            type="number"
            inputMode="numeric"
            value={weeks}
            min={1}
            max={52}
            align="right"
            onChange={(e) => setWeeks(Number(e.target.value))}
            className="w-16"
          />
          <span className="text-muted">weeks</span>
        </label>
        <Input
          type="text"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Notes"
          className="min-w-64 flex-1"
        />
        <Button
          disabled={pending}
          onClick={() => run(() => updateProgramMeta(program.id, { name, weeks, notes }))}
        >
          Save
        </Button>
        {error && <span className="text-xs font-semibold text-danger-text">{error}</span>}
      </div>

      {/* md+: the weeks × days grid */}
      <div className="mt-6 hidden overflow-x-auto md:block">
        <table className="w-full min-w-[40rem] text-sm">
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
                    <DayCell
                      week={week}
                      dayOfWeek={dayIndex + 1}
                      size="sm"
                      className="w-full max-w-32"
                    />
                  </td>
                ))}
                <td className="py-1 text-right">
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => run(() => copyWeekToAll(program.id, week))}
                    className="whitespace-nowrap text-xs text-muted hover:text-foreground disabled:opacity-50"
                    title={`Copy week ${week}'s layout to every other week`}
                  >
                    copy to all
                  </button>
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
              <Button
                variant="ghost"
                size="sm"
                disabled={pending}
                onClick={() => run(() => copyWeekToAll(program.id, week))}
                title={`Copy week ${week}'s layout to every other week`}
              >
                copy to all
              </Button>
            </div>
            <div className="space-y-2">
              {DAY_LABELS.map((label, dayIndex) => (
                <div key={label} className="grid grid-cols-[3rem_1fr] items-center gap-2">
                  <span className="text-xs text-muted">{label}</span>
                  <DayCell week={week} dayOfWeek={dayIndex + 1} size="md" className="w-full" />
                </div>
              ))}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
