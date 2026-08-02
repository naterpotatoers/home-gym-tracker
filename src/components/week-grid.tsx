"use client";

import { useState, useTransition } from "react";
import {
  clearProgramDay,
  copyWeekToAll,
  setProgramDay,
  updateProgramMeta,
} from "@/lib/actions/programs";
import type { Program, ProgramDay, Routine } from "@/lib/types";

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/** Editable program header + the weeks × days grid of routine selects. */
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

  return (
    <div>
      <div className="flex flex-wrap items-baseline gap-3">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="min-w-64 rounded border border-current/20 bg-transparent px-3 py-1.5 text-xl font-bold tracking-tight outline-none"
        />
        <label className="flex items-baseline gap-1 text-sm">
          <input
            type="number"
            value={weeks}
            min={1}
            max={52}
            onChange={(e) => setWeeks(Number(e.target.value))}
            className="w-16 rounded border border-current/20 bg-transparent px-2 py-1 font-mono text-xs"
          />
          <span className="opacity-60">weeks</span>
        </label>
        <input
          type="text"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Notes"
          className="min-w-64 flex-1 rounded border border-current/10 bg-transparent px-3 py-1.5 text-sm outline-none"
        />
        <button
          type="button"
          disabled={pending}
          onClick={() => run(() => updateProgramMeta(program.id, { name, weeks, notes }))}
          className="rounded border border-current/20 px-3 py-1.5 text-sm font-semibold hover:bg-current/10 disabled:opacity-50"
        >
          Save
        </button>
        {error && <span className="text-xs font-semibold">{error}</span>}
      </div>

      <div className="mt-6 overflow-x-auto">
        <table className="w-full min-w-[40rem] text-sm">
          <thead>
            <tr className="border-b border-current/20 text-left">
              <th className="py-1.5 pr-3 text-xs font-semibold uppercase tracking-wide opacity-60">
                Week
              </th>
              {DAY_LABELS.map((label) => (
                <th
                  key={label}
                  className="py-1.5 pr-2 text-xs font-semibold uppercase tracking-wide opacity-60"
                >
                  {label}
                </th>
              ))}
              <th />
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: program.weeks }, (_, i) => i + 1).map((week) => (
              <tr key={week} className="border-b border-current/10">
                <td className="py-1.5 pr-3 font-mono text-xs opacity-60">{week}</td>
                {DAY_LABELS.map((_, dayIndex) => {
                  const dayOfWeek = dayIndex + 1;
                  const value = byCell.get(`${week}|${dayOfWeek}`) ?? "";
                  return (
                    <td key={dayOfWeek} className="py-1 pr-2">
                      <select
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
                        className={`w-full max-w-32 rounded border border-current/20 bg-transparent px-1 py-0.5 text-xs ${
                          value ? "" : "opacity-40"
                        }`}
                      >
                        <option value="">—</option>
                        {sorted.map((routine) => (
                          <option key={routine.id} value={routine.id}>
                            {routine.name}
                          </option>
                        ))}
                      </select>
                    </td>
                  );
                })}
                <td className="py-1 text-right">
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => run(() => copyWeekToAll(program.id, week))}
                    className="whitespace-nowrap text-xs opacity-50 hover:opacity-100 disabled:opacity-30"
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
    </div>
  );
}
