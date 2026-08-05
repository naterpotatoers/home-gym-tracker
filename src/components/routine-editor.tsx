"use client";

import { useMemo, useState } from "react";
import { BodyHeatmap } from "@/components/body-heatmap";
import { ExercisePicker } from "@/components/exercise-picker";
import { CopyIcon, PlusIcon, SwapIcon, TrashIcon } from "@/components/icons";
import { ModalityChip } from "@/components/modality-chip";
import { useDebouncedSave } from "@/components/use-debounced-save";
import {
  Button,
  Field,
  IconButton,
  Input,
  Select,
  StepperInput,
} from "@/components/ui";
import { MuscleCoverageBars } from "@/components/muscle-coverage";
import { MuscleGroupLegend } from "@/components/muscle-group-legend";
import { deleteRoutine, duplicateRoutine, saveRoutine } from "@/lib/actions/routines";
import { coverageByGroup, neglectedMuscles, prescribedCoverage } from "@/lib/coverage";
import { exerciseById, scoresByExercise } from "@/lib/data/exercises";
import { MUSCLE_GROUP_COLORS, muscleById } from "@/lib/data/muscles";
import { heatMax, heatValues, ordinalMax } from "@/lib/heat";
import { bandRolesFor, type Variant } from "@/lib/queries";
import type { Routine, RoutineExercise, UnilateralMode } from "@/lib/types";

type PickerTarget = { mode: "add" } | { mode: "replace"; index: number };

/** The exercise's primary muscle-group color — the same hue its dot wears in
 *  the Clients lift table. Null for mobility (no scores on purpose). */
function groupColor(exerciseId: RoutineExercise["exerciseId"]): string | null {
  const scores = scoresByExercise.get(exerciseId);
  if (!scores || scores.length === 0) return null;
  const top = scores.reduce((a, b) => (b.score > a.score ? b : a));
  const groupId = muscleById.get(top.muscleId)?.groupId;
  return groupId ? MUSCLE_GROUP_COLORS[groupId] : null;
}

function rowFromVariant(routineId: string, variant: Variant, order: number): RoutineExercise {
  const em = variant.exerciseModality;
  const exercise = exerciseById.get(em.exerciseId);
  // Stretches: one hold (per side via unilateralMode), transition-length rest,
  // and no RIR — reps-in-reserve is meaningless for a stretch.
  const isMobility = exercise?.pattern === "mobility";
  return {
    routineId,
    order,
    exerciseId: em.exerciseId,
    modalityId: em.modalityId,
    bandRole: em.bandRoles[0] ?? null,
    unilateralMode: em.defaultUnilateralMode,
    sets: isMobility ? 1 : 3,
    repMin: 10,
    repMax: 10,
    durationSeconds: exercise?.metricType === "time" ? 30 : null,
    restSeconds: isMobility ? 15 : 90,
    targetRir: isMobility ? null : 2,
    supersetGroup: null,
    notes: "",
  };
}

/** Sets + reps carry the prescription — every other field is trim. This tint
 *  lifts them out of the grid so the eye lands there first. */
const emphasisClass = "rounded-lg bg-accent/8 p-2 ring-1 ring-accent/15";

/** Target-reps cell: a single stepper by default (always the initial mode), a
 *  compact min–max line when toggled to range — a row already prescribing a
 *  genuine range stays in range mode so the data is never hidden. The
 *  Single|Range segmented toggle lives in the label row; the two range ends
 *  drag each other so min ≤ max always holds. */
function RepTargets({
  row,
  onPatch,
}: {
  row: RoutineExercise;
  onPatch: (changes: Partial<RoutineExercise>) => void;
}) {
  const isRange =
    row.repMin !== null && row.repMax !== null && row.repMin !== row.repMax;
  const [rangeMode, setRangeMode] = useState(false);
  const showRange = rangeMode || isRange;

  const segment = (active: boolean) =>
    `cursor-pointer px-2 py-1 text-[11px] ${
      active
        ? "bg-accent-soft font-semibold text-accent-text"
        : "text-muted hover:bg-current/5 hover:text-foreground"
    }`;

  return (
    <div className={`flex flex-col gap-1 ${emphasisClass}`}>
      <span className="flex items-center justify-between gap-2">
        <span className="text-[11px] uppercase tracking-wide text-muted">Reps</span>
        <span className="inline-flex overflow-hidden rounded-md border border-border-strong bg-surface">
          <button
            type="button"
            onClick={() => {
              setRangeMode(false);
              if (isRange) onPatch({ repMin: row.repMax, repMax: row.repMax });
            }}
            aria-pressed={!showRange}
            className={segment(!showRange)}
          >
            Single
          </button>
          <button
            type="button"
            onClick={() => setRangeMode(true)}
            aria-pressed={showRange}
            className={`border-l border-border-strong ${segment(showRange)}`}
          >
            Range
          </button>
        </span>
      </span>
      {showRange ? (
        <div className="flex items-center gap-1">
          <StepperInput
            size="sm"
            value={row.repMin}
            min={1}
            onChange={(v) =>
              onPatch({
                repMin: v,
                repMax: v !== null && row.repMax !== null && v > row.repMax ? v : row.repMax,
              })
            }
            className="w-12"
          />
          <span className="text-muted">–</span>
          <StepperInput
            size="sm"
            value={row.repMax}
            min={1}
            onChange={(v) =>
              onPatch({
                repMax: v,
                repMin: v !== null && row.repMin !== null && v < row.repMin ? v : row.repMin,
              })
            }
            className="w-12"
          />
        </div>
      ) : (
        <StepperInput
          value={row.repMax ?? row.repMin}
          min={1}
          onChange={(v) => onPatch({ repMin: v, repMax: v })}
        />
      )}
    </div>
  );
}

export function RoutineEditor({
  routine,
  initialRows,
  variants,
  recentKeys,
}: {
  routine: Routine;
  initialRows: RoutineExercise[];
  variants: Variant[];
  recentKeys?: string[];
}) {
  const [name, setName] = useState(routine.name);
  const [notes, setNotes] = useState(routine.notes);
  const [rows, setRows] = useState<RoutineExercise[]>(initialRows);
  const [picker, setPicker] = useState<PickerTarget | null>(null);
  const [coverageOpen, setCoverageOpen] = useState(false);
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  // Debounced autosave — every edit persists ~1s after the last change.
  const { saveState, error, setError } = useDebouncedSave(
    [name, notes, rows, routine.id],
    () => saveRoutine(routine.id, { name, notes }, rows),
  );

  const coverage = useMemo(() => prescribedCoverage(rows), [rows]);
  const neglected = useMemo(() => neglectedMuscles(coverage), [coverage]);
  const heat = useMemo(() => {
    const max = heatMax({ coverage });
    return {
      max,
      values: heatValues({ coverage }, max, ordinalMax({ coverage })),
    };
  }, [coverage]);

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

      {/* Card edges + dots below are colored by primary muscle group. */}
      <div className="mt-4">
        <MuscleGroupLegend />
      </div>

      <div className="mt-6 space-y-3">
        {rows.map((row, index) => {
          const exercise = exerciseById.get(row.exerciseId);
          const timed = exercise?.metricType === "time";
          const color = groupColor(row.exerciseId);
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
              className={`rounded-xl border border-l-4 bg-surface p-3 ${
                dragIndex === index ? "border-accent shadow-lg" : "border-border"
              }`}
              style={
                dragIndex === index ? undefined : { borderLeftColor: color ?? undefined }
              }
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
                {color && (
                  <span
                    className="size-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: color }}
                  />
                )}
                <span className="text-sm font-semibold">
                  {exercise?.name ?? row.exerciseId}
                </span>
                <ModalityChip modalityId={row.modalityId} />
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
                    <SwapIcon size={14} /> Swap
                  </Button>
                  <IconButton onClick={() => move(index, -1)} disabled={index === 0} aria-label="Move up">↑</IconButton>
                  <IconButton onClick={() => move(index, 1)} disabled={index === rows.length - 1} aria-label="Move down">↓</IconButton>
                  <IconButton variant="ghost" onClick={() => setRows((prev) => prev.filter((_, i) => i !== index))} aria-label="Remove exercise"><TrashIcon /></IconButton>
                </span>
              </div>

              {/* Strict grid, max 3 columns: Sets|Reps|Rest / RIR|Superset|Mode
                  / Notes full-width — every card lines up the same way. */}
              <div className="mt-3 grid grid-cols-2 items-start gap-3 text-sm md:grid-cols-3">
                <div className={emphasisClass}>
                  <Field label="Sets">
                    <StepperInput value={row.sets} min={1} onChange={(v) => patch(index, { sets: v ?? 1 })} />
                  </Field>
                </div>
                {timed ? (
                  <div className={emphasisClass}>
                    <Field label="Seconds">
                      <StepperInput value={row.durationSeconds} min={5} step={5} onChange={(v) => patch(index, { durationSeconds: v })} />
                    </Field>
                  </div>
                ) : (
                  <RepTargets row={row} onPatch={(changes) => patch(index, changes)} />
                )}
                <Field label="Rest (s)">
                  <StepperInput value={row.restSeconds} min={0} step={15} onChange={(v) => patch(index, { restSeconds: v ?? 0 })} />
                </Field>
                <Field label="Target RIR">
                  <StepperInput value={row.targetRir} min={0} max={5} onChange={(v) => patch(index, { targetRir: v })} />
                </Field>
                <Field label="Superset">
                  {/* Adjacent exercises sharing a label run interleaved
                      (A1 B1 A2 B2…) with no rest inside the pair. */}
                  <Select
                    value={row.supersetGroup ?? ""}
                    onChange={(e) => patch(index, { supersetGroup: e.target.value || null })}
                  >
                    <option value="">—</option>
                    {row.supersetGroup && !["A", "B", "C"].includes(row.supersetGroup) && (
                      <option value={row.supersetGroup}>{row.supersetGroup}</option>
                    )}
                    <option value="A">A</option>
                    <option value="B">B</option>
                    <option value="C">C</option>
                  </Select>
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
                <div className="col-span-2 md:col-span-3">
                  <Field label="Notes">
                    <Input
                      type="text"
                      value={row.notes}
                      onChange={(e) => patch(index, { notes: e.target.value })}
                      className="w-full"
                      placeholder="—"
                    />
                  </Field>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Button variant="primary" onClick={() => setPicker({ mode: "add" })}>
          <PlusIcon size={16} /> Add exercise
        </Button>
        <Button
          size="sm"
          className="ml-auto"
          onClick={async () => {
            try {
              await duplicateRoutine(routine.id);
            } catch (e) {
              setError(e instanceof Error ? e.message : "Duplicate failed.");
            }
          }}
        >
          <CopyIcon size={16} /> Duplicate
        </Button>
        <Button variant="danger" size="sm" onClick={handleDelete}>
          <TrashIcon size={16} /> Delete routine
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
          recentKeys={recentKeys}
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
