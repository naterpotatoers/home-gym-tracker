"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { BodyHeatmap } from "@/components/body-heatmap";
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
import { heatMax, heatValues, ordinalMax } from "@/lib/heat";
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
    repMin: 10,
    repMax: 10,
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
  const [error, setError] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">("idle");
  const [coverageOpen, setCoverageOpen] = useState(false);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const firstRender = useRef(true);

  const coverage = useMemo(() => prescribedCoverage(rows), [rows]);
  const neglected = useMemo(() => neglectedMuscles(coverage), [coverage]);
  const heat = useMemo(() => {
    const max = heatMax({ coverage });
    return {
      max,
      values: heatValues({ coverage }, max, ordinalMax({ coverage })),
    };
  }, [coverage]);

  // Debounced autosave — every edit persists ~1s after the last change.
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    setSaveState("saving");
    const timer = setTimeout(async () => {
      try {
        await saveRoutine(routine.id, { name, notes }, rows);
        setSaveState("saved");
        setError(null);
      } catch (e) {
        setSaveState("idle");
        setError(e instanceof Error ? e.message : "Save failed.");
      }
    }, 1000);
    return () => clearTimeout(timer);
  }, [name, notes, rows, routine.id]);

  function patch(index: number, changes: Partial<RoutineExercise>) {
    setRows((prev) => prev.map((row, i) => (i === index ? { ...row, ...changes } : row)));
  }

  function move(index: number, delta: -1 | 1) {
    setRows((prev) => {
      const next = [...prev];
      const target = index + delta;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  /** Live reorder while dragging — the card follows the pointer row by row. */
  function dragTo(index: number) {
    if (dragIndex === null || dragIndex === index) return;
    setRows((prev) => {
      const next = [...prev];
      const [moved] = next.splice(dragIndex, 1);
      next.splice(index, 0, moved);
      return next;
    });
    setDragIndex(index);
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
      <div className="flex flex-wrap items-center gap-3">
        <Input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="min-w-64 text-xl font-bold tracking-tight"
        />
        <Input
          type="text"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Notes"
          className="min-w-64 flex-1"
        />
        <span className="text-xs text-muted">
          {saveState === "saving" ? "saving…" : saveState === "saved" ? "saved" : ""}
        </span>
        {error && <span className="text-xs font-semibold text-danger-text">{error}</span>}
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
              onDragOver={(e) => {
                e.preventDefault();
                dragTo(index);
              }}
              onDrop={(e) => e.preventDefault()}
              className={`rounded-xl border bg-surface p-3 ${
                dragIndex === index ? "border-accent shadow-lg" : "border-border"
              }`}
            >
              <div className="flex flex-wrap items-center gap-2">
                <span
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.effectAllowed = "move";
                    setDragIndex(index);
                  }}
                  onDragEnd={() => setDragIndex(null)}
                  className="cursor-grab touch-none select-none px-1.5 py-2 text-muted active:cursor-grabbing"
                  title="Drag to reorder"
                  aria-label="Drag to reorder"
                >
                  ⠿
                </span>
                <span className="font-mono text-xs text-muted">{index + 1}.</span>
                <span className="text-sm font-semibold">
                  {exercise?.name ?? row.exerciseId}
                </span>
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
                <span className="ml-auto flex items-center gap-1">
                  <Button
                    size="sm"
                    onClick={() => setPicker({ mode: "replace", index })}
                  >
                    Swap
                  </Button>
                  <IconButton onClick={() => move(index, -1)} disabled={index === 0} aria-label="Move up">↑</IconButton>
                  <IconButton onClick={() => move(index, 1)} disabled={index === rows.length - 1} aria-label="Move down">↓</IconButton>
                  <IconButton variant="ghost" onClick={() => setRows((prev) => prev.filter((_, i) => i !== index))} aria-label="Remove exercise">✕</IconButton>
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
                  <Field label="Target reps">
                    <NumberInput
                      value={row.repMax ?? row.repMin}
                      min={1}
                      onChange={(v) => patch(index, { repMin: v, repMax: v })}
                    />
                  </Field>
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
        <Button variant="primary" onClick={() => setPicker({ mode: "add" })}>
          + Add exercise
        </Button>
        <Button variant="danger" size="sm" onClick={handleDelete} className="ml-auto">
          Delete routine
        </Button>
      </div>

      {/* Floating coverage toggle — sits clear of the mobile tab bar. */}
      <button
        type="button"
        onClick={() => setCoverageOpen(true)}
        className="fixed bottom-20 right-4 z-40 inline-flex min-h-11 items-center gap-2 rounded-full bg-accent-strong px-4 text-sm font-semibold text-accent-fg shadow-lg hover:opacity-90 md:bottom-6"
      >
        Coverage
        {neglected.length > 0 && (
          <span className="rounded-full bg-danger px-1.5 py-0.5 font-mono text-[10px] text-white">
            {neglected.length}
          </span>
        )}
      </button>

      {/* Coverage side sheet — quick reference without scrolling away. */}
      {coverageOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/40"
          onClick={() => setCoverageOpen(false)}
        >
          <div
            className="ml-auto flex h-dvh w-full max-w-md flex-col overflow-y-auto border-l border-border bg-surface p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between border-b border-border pb-2">
              <h2 className="text-lg font-semibold">Muscle coverage</h2>
              <Button variant="ghost" onClick={() => setCoverageOpen(false)}>
                Close
              </Button>
            </div>
            {neglected.length > 0 && (
              <p className="mb-3 text-xs text-danger-text">
                Possibly neglected: <strong>{neglected.join(", ")}</strong>
              </p>
            )}
            <BodyHeatmap
              values={heat.values}
              title="Body map"
              maxLabel={`${heat.max.toFixed(1)} sets/wk`}
            />
            <div className="mt-6">
              <MuscleCoverageBars groups={coverageByGroup(coverage)} />
            </div>
          </div>
        </div>
      )}

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
