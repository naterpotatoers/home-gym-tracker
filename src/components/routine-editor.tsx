"use client";

import { useMemo, useState } from "react";
import { ExercisePicker } from "@/components/exercise-picker";
import { MuscleCoverageBars } from "@/components/muscle-coverage";
import { deleteRoutine, saveRoutine } from "@/lib/actions/routines";
import { coverageByGroup, neglectedMuscles, prescribedCoverage } from "@/lib/coverage";
import { exerciseById } from "@/lib/data/exercises";
import { bandRolesFor, type Variant } from "@/lib/queries";
import type { Routine, RoutineExercise, UnilateralMode } from "@/lib/types";

type PickerTarget = { mode: "add" } | { mode: "replace"; index: number };

function rowFromVariant(routineId: string, variant: Variant, order: number): RoutineExercise {
  const em = variant.exerciseModality;
  return {
    routineId,
    order,
    exerciseId: em.exerciseId,
    modalityId: em.modalityId,
    bandRole: em.bandRoles[0] ?? null,
    unilateralMode: em.defaultUnilateralMode,
    sets: 3,
    repMin: 8,
    repMax: 12,
    durationSeconds:
      exerciseById.get(em.exerciseId)?.metricType === "time" ? 30 : null,
    restSeconds: 90,
    targetRir: 2,
    supersetGroup: null,
    notes: "",
  };
}

export function RoutineEditor({
  routine,
  initialRows,
  variants,
}: {
  routine: Routine;
  initialRows: RoutineExercise[];
  variants: Variant[];
}) {
  const [name, setName] = useState(routine.name);
  const [notes, setNotes] = useState(routine.notes);
  const [rows, setRows] = useState<RoutineExercise[]>(initialRows);
  const [picker, setPicker] = useState<PickerTarget | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const coverage = useMemo(() => prescribedCoverage(rows), [rows]);
  const neglected = useMemo(() => neglectedMuscles(coverage), [coverage]);

  function patch(index: number, changes: Partial<RoutineExercise>) {
    setRows((prev) => prev.map((row, i) => (i === index ? { ...row, ...changes } : row)));
    setSaved(false);
  }

  function move(index: number, delta: -1 | 1) {
    setRows((prev) => {
      const next = [...prev];
      const target = index + delta;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
    setSaved(false);
  }

  function handlePick(variant: Variant) {
    if (!picker) return;
    if (picker.mode === "add") {
      setRows((prev) => [...prev, rowFromVariant(routine.id, variant, prev.length + 1)]);
    } else {
      const em = variant.exerciseModality;
      patch(picker.index, {
        exerciseId: em.exerciseId,
        modalityId: em.modalityId,
        bandRole: em.bandRoles[0] ?? null,
        unilateralMode: em.defaultUnilateralMode,
      });
    }
    setPicker(null);
    setSaved(false);
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      await saveRoutine(routine.id, { name, notes }, rows);
      setSaved(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!confirm(`Delete routine "${name}"?`)) return;
    setError(null);
    try {
      await deleteRoutine(routine.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed.");
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-baseline gap-3">
        <input
          type="text"
          value={name}
          onChange={(e) => { setName(e.target.value); setSaved(false); }}
          className="min-w-64 rounded border border-current/20 bg-transparent px-3 py-1.5 text-xl font-bold tracking-tight outline-none"
        />
        <input
          type="text"
          value={notes}
          onChange={(e) => { setNotes(e.target.value); setSaved(false); }}
          placeholder="Notes"
          className="min-w-64 flex-1 rounded border border-current/10 bg-transparent px-3 py-1.5 text-sm outline-none"
        />
      </div>

      <div className="mt-6 space-y-3">
        {rows.map((row, index) => {
          const exercise = exerciseById.get(row.exerciseId);
          const timed = exercise?.metricType === "time";
          const bandRoles = row.modalityId === "band"
            ? bandRolesFor(row.exerciseId, row.modalityId)
            : [];
          return (
            <div
              key={`${row.exerciseId}-${row.modalityId}-${index}`}
              className="rounded-lg border border-current/10 p-3"
            >
              <div className="flex flex-wrap items-baseline gap-2">
                <span className="font-mono text-xs opacity-40">{index + 1}.</span>
                <button
                  type="button"
                  onClick={() => setPicker({ mode: "replace", index })}
                  className="text-sm font-semibold underline-offset-2 hover:underline"
                  title="Replace exercise"
                >
                  {exercise?.name ?? row.exerciseId}
                </button>
                <span className="rounded bg-current/10 px-1.5 py-0.5 text-xs">
                  {row.modalityId}
                </span>
                {bandRoles.length > 1 ? (
                  <select
                    value={row.bandRole ?? ""}
                    onChange={(e) => patch(index, { bandRole: e.target.value as RoutineExercise["bandRole"] })}
                    className="rounded border border-current/20 bg-transparent px-1 py-0.5 text-xs"
                  >
                    {bandRoles.map((role) => (
                      <option key={role} value={role}>{role}</option>
                    ))}
                  </select>
                ) : (
                  row.bandRole && <span className="text-xs opacity-60">{row.bandRole}</span>
                )}
                <span className="ml-auto flex gap-1">
                  <button type="button" onClick={() => move(index, -1)} className="rounded border border-current/20 px-1.5 text-xs disabled:opacity-30" disabled={index === 0}>↑</button>
                  <button type="button" onClick={() => move(index, 1)} className="rounded border border-current/20 px-1.5 text-xs disabled:opacity-30" disabled={index === rows.length - 1}>↓</button>
                  <button type="button" onClick={() => { setRows((prev) => prev.filter((_, i) => i !== index)); setSaved(false); }} className="rounded border border-current/20 px-1.5 text-xs opacity-60 hover:opacity-100">✕</button>
                </span>
              </div>

              <div className="mt-2 flex flex-wrap items-end gap-x-4 gap-y-2 text-sm">
                <Field label="Sets">
                  <NumberInput value={row.sets} min={1} onChange={(v) => patch(index, { sets: v ?? 1 })} />
                </Field>
                {timed ? (
                  <Field label="Seconds">
                    <NumberInput value={row.durationSeconds} min={5} step={5} onChange={(v) => patch(index, { durationSeconds: v })} />
                  </Field>
                ) : (
                  <>
                    <Field label="Rep min">
                      <NumberInput value={row.repMin} min={1} onChange={(v) => patch(index, { repMin: v })} />
                    </Field>
                    <Field label="Rep max">
                      <NumberInput value={row.repMax} min={1} onChange={(v) => patch(index, { repMax: v })} />
                    </Field>
                  </>
                )}
                <Field label="Rest (s)">
                  <NumberInput value={row.restSeconds} min={0} step={15} onChange={(v) => patch(index, { restSeconds: v ?? 0 })} />
                </Field>
                <Field label="Target RIR">
                  <NumberInput value={row.targetRir} min={0} onChange={(v) => patch(index, { targetRir: v })} />
                </Field>
                <Field label="Mode">
                  <select
                    value={row.unilateralMode}
                    onChange={(e) => patch(index, { unilateralMode: e.target.value as UnilateralMode })}
                    className="rounded border border-current/20 bg-transparent px-1 py-0.5 text-xs"
                  >
                    <option value="bilateral">bilateral</option>
                    <option value="alternating">alternating</option>
                    <option value="single_side">single side</option>
                  </select>
                </Field>
                <Field label="Superset">
                  <input
                    type="text"
                    value={row.supersetGroup ?? ""}
                    onChange={(e) => patch(index, { supersetGroup: e.target.value || null })}
                    className="w-24 rounded border border-current/20 bg-transparent px-1 py-0.5 text-xs"
                    placeholder="—"
                  />
                </Field>
                <Field label="Notes">
                  <input
                    type="text"
                    value={row.notes}
                    onChange={(e) => patch(index, { notes: e.target.value })}
                    className="w-48 rounded border border-current/20 bg-transparent px-1 py-0.5 text-xs"
                    placeholder="—"
                  />
                </Field>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => setPicker({ mode: "add" })}
          className="rounded border border-current/20 px-3 py-1.5 text-sm hover:bg-current/10"
        >
          + Add exercise
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="rounded border border-current/20 bg-current/10 px-4 py-1.5 text-sm font-semibold hover:bg-current/20 disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save routine"}
        </button>
        {saved && <span className="text-xs opacity-60">Saved.</span>}
        {error && <span className="text-xs font-semibold">{error}</span>}
        <button
          type="button"
          onClick={handleDelete}
          className="ml-auto text-xs opacity-50 hover:opacity-100"
        >
          Delete routine
        </button>
      </div>

      <section className="mt-10">
        <h2 className="mb-3 border-b border-current/20 pb-1 text-lg font-semibold">
          Muscle coverage
        </h2>
        {neglected.length > 0 && (
          <p className="mb-3 text-xs opacity-70">
            Possibly neglected: <strong>{neglected.join(", ")}</strong>
          </p>
        )}
        <MuscleCoverageBars groups={coverageByGroup(coverage)} />
      </section>

      {picker && (
        <ExercisePicker
          variants={variants}
          onSelect={handlePick}
          onClose={() => setPicker(null)}
          emphasizePattern={
            picker.mode === "replace"
              ? exerciseById.get(rows[picker.index].exerciseId)?.pattern
              : undefined
          }
        />
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-0.5">
      <span className="text-[10px] uppercase tracking-wide opacity-50">{label}</span>
      {children}
    </label>
  );
}

function NumberInput({
  value,
  onChange,
  min,
  step,
}: {
  value: number | null;
  onChange: (value: number | null) => void;
  min?: number;
  step?: number;
}) {
  return (
    <input
      type="number"
      value={value ?? ""}
      min={min}
      step={step}
      onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))}
      className="w-16 rounded border border-current/20 bg-transparent px-1 py-0.5 font-mono text-xs"
    />
  );
}
