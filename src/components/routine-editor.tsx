"use client";

import { useMemo, useState } from "react";
import { ExercisePicker } from "@/components/exercise-picker";
import {
  Button,
  Field,
  IconButton,
  Input,
  NumberInput,
  Select,
} from "@/components/ui";
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
        <Input
          type="text"
          value={name}
          onChange={(e) => { setName(e.target.value); setSaved(false); }}
          className="min-w-64 text-xl font-bold tracking-tight"
        />
        <Input
          type="text"
          value={notes}
          onChange={(e) => { setNotes(e.target.value); setSaved(false); }}
          placeholder="Notes"
          className="min-w-64 flex-1"
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
              className="rounded-xl border border-border bg-surface p-3"
            >
              <div className="flex flex-wrap items-baseline gap-2">
                <span className="font-mono text-xs text-muted">{index + 1}.</span>
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
                  <Select
                    size="sm"
                    value={row.bandRole ?? ""}
                    onChange={(e) => patch(index, { bandRole: e.target.value as RoutineExercise["bandRole"] })}
                  >
                    {bandRoles.map((role) => (
                      <option key={role} value={role}>{role}</option>
                    ))}
                  </Select>
                ) : (
                  row.bandRole && <span className="text-xs text-muted">{row.bandRole}</span>
                )}
                <span className="ml-auto flex gap-1">
                  <IconButton onClick={() => move(index, -1)} disabled={index === 0} aria-label="Move up">↑</IconButton>
                  <IconButton onClick={() => move(index, 1)} disabled={index === rows.length - 1} aria-label="Move down">↓</IconButton>
                  <IconButton variant="ghost" onClick={() => { setRows((prev) => prev.filter((_, i) => i !== index)); setSaved(false); }} aria-label="Remove exercise">✕</IconButton>
                </span>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-3 lg:flex lg:flex-wrap lg:items-end">
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
                  <Select
                    value={row.unilateralMode}
                    onChange={(e) => patch(index, { unilateralMode: e.target.value as UnilateralMode })}
                  >
                    <option value="bilateral">bilateral</option>
                    <option value="alternating">alternating</option>
                    <option value="single_side">single side</option>
                  </Select>
                </Field>
                <Field label="Superset">
                  <Input
                    type="text"
                    value={row.supersetGroup ?? ""}
                    onChange={(e) => patch(index, { supersetGroup: e.target.value || null })}
                    className="w-full lg:w-24"
                    placeholder="—"
                  />
                </Field>
                <Field label="Notes">
                  <Input
                    type="text"
                    value={row.notes}
                    onChange={(e) => patch(index, { notes: e.target.value })}
                    className="w-full lg:w-48"
                    placeholder="—"
                  />
                </Field>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Button onClick={() => setPicker({ mode: "add" })}>
          + Add exercise
        </Button>
        <Button variant="primary" onClick={handleSave} disabled={saving}>
          {saving ? "Saving…" : "Save routine"}
        </Button>
        {saved && <span className="text-xs text-success-text">Saved.</span>}
        {error && <span className="text-xs font-semibold text-danger-text">{error}</span>}
        <Button variant="danger" size="sm" onClick={handleDelete} className="ml-auto">
          Delete routine
        </Button>
      </div>

      <section className="mt-10">
        <h2 className="mb-3 border-b border-border pb-1 text-lg font-semibold">
          Muscle coverage
        </h2>
        {neglected.length > 0 && (
          <p className="mb-3 text-xs text-danger-text">
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
