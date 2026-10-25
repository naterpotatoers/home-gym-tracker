"use client";

import Link from "next/link";
import { unstable_rethrow } from "next/navigation";
import { useMemo, useState } from "react";
import { BodyHeatmap } from "@/components/body-heatmap";
import { ExercisePicker } from "@/components/exercise-picker";
import { ArrowLeftIcon, CopyIcon, PlusIcon, SwapIcon, TrashIcon } from "@/components/icons";
import { ModalityChip } from "@/components/modality-chip";
import { OverflowMenu } from "@/components/overflow-menu";
import { useDebouncedSave } from "@/components/use-debounced-save";
import {
  Button,
  chipClass,
  ColorDot,
  ErrorText,
  Input,
  Select,
  StepperInput,
} from "@/components/ui";
import { MuscleCoverageBars } from "@/components/muscle-coverage";
import { MuscleGroupLegend } from "@/components/muscle-group-legend";
import { deleteRoutine, duplicateRoutine, saveRoutine } from "@/lib/actions/routines";
import { coverageByGroup, prescribedCoverage } from "@/lib/coverage";
import { MUSCLE_GROUP_COLORS, muscleById } from "@/lib/data/muscles";
import { exerciseLookup, type ExerciseCatalog } from "@/lib/exercise-catalog";
import { heatMax, heatValues, ordinalMax } from "@/lib/heat";
import { newId } from "@/lib/ids";
import { bandRolesFor, type Variant } from "@/lib/queries";
import type { Routine, RoutineExercise, UnilateralMode } from "@/lib/types";
import { errorMessage } from "@/lib/format";
import { rxLabel } from "@/lib/session-labels";

type PickerTarget = { mode: "add" } | { mode: "replace"; index: number };

/** A row plus a client-only identity. Rows have no id of their own (the PK is
 *  routine × sort_order), and an index/exercise key would remount a card on
 *  every reorder — losing its local state (rep mode, open details). */
type EditorRow = RoutineExercise & { rowKey: string };

function withKey(row: RoutineExercise): EditorRow {
  return { ...row, rowKey: newId("row") };
}

function withoutKey({ rowKey, ...row }: EditorRow): RoutineExercise {
  void rowKey;
  return row;
}

/** The exercise's primary muscle-group color — the same hue its dot wears in
 *  the Clients lift table. Null for mobility (no scores on purpose). */
function groupColor(
  catalog: ExerciseCatalog,
  exerciseId: RoutineExercise["exerciseId"],
): string | null {
  const scores = exerciseLookup(catalog).scoresByExercise.get(exerciseId);
  if (!scores || scores.length === 0) return null;
  const top = scores.reduce((a, b) => (b.score > a.score ? b : a));
  const groupId = muscleById.get(top.muscleId)?.groupId;
  return groupId ? MUSCLE_GROUP_COLORS[groupId] : null;
}

function rowFromVariant(routineId: string, variant: Variant, order: number): RoutineExercise {
  const em = variant.exerciseModality;
  // Stretches: one hold (per side via unilateralMode), transition-length rest,
  // and no RIR — reps-in-reserve is meaningless for a stretch.
  const isMobility = variant.pattern === "mobility";
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
    durationSeconds: variant.metricType === "time" ? 30 : null,
    restSeconds: isMobility ? 15 : 90,
    targetRir: isMobility ? null : 2,
    supersetGroup: null,
    notes: "",
  };
}

/** A field in the open row: small label over its control, like the Reps
 *  cell's label row. Fields bottom-align, so controls share a baseline. */
function Captioned({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <span className="flex flex-col items-start gap-1">
      <span className="text-[10px] uppercase tracking-wide text-muted">{label}</span>
      {children}
    </span>
  );
}

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
    `min-h-9 cursor-pointer px-2 text-[11px] pointer-coarse:min-h-11 pointer-coarse:px-3 ${
      active
        ? "bg-accent-soft font-semibold text-accent-text"
        : "text-muted hover:bg-current/5 hover:text-foreground"
    }`;

  return (
    <span className="flex flex-col items-start gap-1">
      <span className="flex items-center gap-2">
        <span className="text-[10px] uppercase tracking-wide text-muted">Reps</span>
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
          size="sm"
          value={row.repMax ?? row.repMin}
          min={1}
          onChange={(v) => onPatch({ repMin: v, repMax: v })}
          label="reps"
          className="w-14"
        />
      )}
    </span>
  );
}

export function RoutineEditor({
  routine,
  initialRows,
  variants,
  catalog,
  recentKeys,
}: {
  routine: Routine;
  initialRows: RoutineExercise[];
  variants: Variant[];
  catalog: ExerciseCatalog;
  recentKeys?: string[];
}) {
  const [name, setName] = useState(routine.name);
  const [notes, setNotes] = useState(routine.notes);
  const [rows, setRows] = useState<EditorRow[]>(() => initialRows.map(withKey));
  const [picker, setPicker] = useState<PickerTarget | null>(null);
  const [coverageOpen, setCoverageOpen] = useState(false);
  /** The one row open for editing — everything else is a one-line summary. */
  const [openKey, setOpenKey] = useState<string | null>(null);

  // Debounced autosave — every edit persists ~1s after the last change.
  const autosave = useDebouncedSave(
    [name, notes, rows, routine.id],
    () => saveRoutine(routine.id, { name, notes }, rows.map(withoutKey)),
  );
  const { saveState, error, setError } = autosave;

  const coverage = useMemo(() => prescribedCoverage(catalog, rows), [catalog, rows]);
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

  function handlePick(variant: Variant) {
    if (!picker) return;
    if (picker.mode === "add") {
      const added = withKey(rowFromVariant(routine.id, variant, rows.length + 1));
      setRows((prev) => [...prev, added]);
      setOpenKey(added.rowKey);
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

  async function handleDuplicate() {
    setError(null);
    try {
      // The copy is made from the DB — save the last second's edits first.
      await autosave.flush();
      await duplicateRoutine(routine.id);
    } catch (e) {
      unstable_rethrow(e);
      setError(errorMessage(e, "Duplicate failed."));
    }
  }

  async function handleDelete() {
    if (!confirm(`Delete routine "${name}"?`)) return;
    setError(null);
    // No autosave may land after the delete (it would fail, or worse race it).
    autosave.cancel();
    try {
      await deleteRoutine(routine.id);
    } catch (e) {
      // deleteRoutine redirects on success — that internal throw must pass
      // through or the redirect would render as "Delete failed."
      unstable_rethrow(e);
      autosave.resume();
      setError(errorMessage(e, "Delete failed."));
    }
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
          aria-label="Routine name"
          className="min-w-0 flex-[3] basis-72 font-semibold"
        />
        <Input
          type="text"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Notes"
          aria-label="Routine notes"
          className="min-w-0 flex-[2] basis-56"
        />
        <span className="text-xs text-muted">
          {saveState === "saving" ? "saving…" : saveState === "saved" ? "saved" : ""}
        </span>
        <OverflowMenu
          label="Routine actions"
          size="md"
          items={[
            { label: "Duplicate routine", icon: <CopyIcon size={16} />, onSelect: handleDuplicate },
            { label: "Delete routine", icon: <TrashIcon size={16} />, onSelect: handleDelete, danger: true },
          ]}
        />
        {error && <ErrorText>{error}</ErrorText>}
      </div>

      {/* Row edges + dots below are colored by primary muscle group. */}
      {rows.length > 0 && (
        <div className="mt-3">
          <MuscleGroupLegend />
        </div>
      )}

      {rows.length > 0 && (
        <ul className="mt-4 divide-y divide-border overflow-visible rounded-xl border border-border bg-surface">
          {rows.map((row, index) => {
            const exercise = exerciseLookup(catalog).exerciseById.get(row.exerciseId);
            const name = exercise?.name ?? row.exerciseId;
            const timed = exercise?.metricType === "time";
            const color = groupColor(catalog, row.exerciseId);
            const bandRoles =
              row.modalityId === "band"
                ? bandRolesFor(catalog, row.exerciseId, row.modalityId)
                : [];
            const open = row.rowKey === openKey;
            const menu = (
              <OverflowMenu
                label={`${name} actions`}
                items={[
                  {
                    label: "Swap exercise",
                    icon: <SwapIcon size={16} />,
                    onSelect: () => setPicker({ mode: "replace", index }),
                  },
                  { label: "Move up", onSelect: () => move(index, -1), disabled: index === 0 },
                  {
                    label: "Move down",
                    onSelect: () => move(index, 1),
                    disabled: index === rows.length - 1,
                  },
                  {
                    label: "Remove",
                    icon: <TrashIcon size={16} />,
                    danger: true,
                    onSelect: () => {
                      if (confirm(`Remove ${name} from the routine?`)) {
                        setRows((prev) => prev.filter((_, i) => i !== index));
                      }
                    },
                  },
                ]}
              />
            );
            return (
              <li
                key={row.rowKey}
                // Left edge = primary muscle group (legend above).
                className={`border-l-4 first:rounded-tl-xl last:rounded-bl-xl ${
                  open ? "bg-accent-soft/60" : ""
                }`}
                style={{ borderLeftColor: color ?? "transparent" }}
              >
                <div className="flex items-center gap-1 pr-1">
                  <button
                    type="button"
                    onClick={() => setOpenKey(open ? null : row.rowKey)}
                    aria-expanded={open}
                    className="flex min-h-11 min-w-0 flex-1 cursor-pointer flex-wrap items-center gap-x-2 gap-y-0.5 rounded-md px-2 py-1.5 text-left hover:bg-current/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent/60"
                  >
                    <span className="w-5 font-mono text-xs text-muted">{index + 1}.</span>
                    <ColorDot color={color} />
                    <span className="text-sm font-semibold">{name}</span>
                    <ModalityChip modalityId={row.modalityId} />
                    {row.supersetGroup && (
                      <span className="rounded bg-accent-soft px-1.5 py-0.5 text-[11px] font-semibold text-accent-text">
                        superset {row.supersetGroup}
                      </span>
                    )}
                    <span className="font-mono text-xs text-muted">
                      {rxLabel(row)}
                      {row.unilateralMode !== "bilateral" &&
                        ` · ${row.unilateralMode.replace("_", " ")}`}
                    </span>
                    {!open && row.notes && (
                      <span className="w-full truncate pl-7 text-xs text-muted">{row.notes}</span>
                    )}
                  </button>
                  {menu}
                </div>

                {open && (
                  <div className="space-y-3 px-3 pb-3 pl-9 pt-1 text-sm">
                    {/* Prescription: sets · reps (or seconds) · rest */}
                    <div className="flex flex-wrap items-end gap-x-5 gap-y-3">
                      <Captioned label="Sets">
                        <StepperInput size="sm" value={row.sets} min={1} onChange={(v) => patch(index, { sets: v ?? 1 })} label="sets" className="w-12" />
                      </Captioned>
                      {timed ? (
                        <Captioned label="Seconds">
                          <StepperInput size="sm" value={row.durationSeconds} min={5} step={5} onChange={(v) => patch(index, { durationSeconds: v })} label="seconds" className="w-14" />
                        </Captioned>
                      ) : (
                        <RepTargets row={row} onPatch={(changes) => patch(index, changes)} />
                      )}
                      <Captioned label="Rest (s)">
                        <StepperInput size="sm" value={row.restSeconds} min={0} step={15} onChange={(v) => patch(index, { restSeconds: v ?? 0 })} label="rest" className="w-14" />
                      </Captioned>
                    </div>
                    {/* Trim: RIR · superset · mode · band role */}
                    <div className="flex flex-wrap items-end gap-x-5 gap-y-3">
                      <Captioned label="Target RIR">
                        <StepperInput size="sm" value={row.targetRir} min={0} max={5} onChange={(v) => patch(index, { targetRir: v })} label="target RIR" className="w-12" />
                      </Captioned>
                      <Captioned label="Superset">
                        {/* Adjacent exercises sharing a label run interleaved
                            (A1 B1 A2 B2…) with no rest inside the pair. */}
                        <Select
                          size="sm"
                          value={row.supersetGroup ?? ""}
                          onChange={(e) => patch(index, { supersetGroup: e.target.value || null })}
                          aria-label="Superset"
                        >
                          <option value="">—</option>
                          {row.supersetGroup && !["A", "B", "C"].includes(row.supersetGroup) && (
                            <option value={row.supersetGroup}>{row.supersetGroup}</option>
                          )}
                          <option value="A">A</option>
                          <option value="B">B</option>
                          <option value="C">C</option>
                        </Select>
                      </Captioned>
                      <Captioned label="Mode">
                        <Select
                          size="sm"
                          value={row.unilateralMode}
                          onChange={(e) => patch(index, { unilateralMode: e.target.value as UnilateralMode })}
                          aria-label="Mode"
                        >
                          <option value="bilateral">bilateral</option>
                          <option value="alternating">alternating</option>
                          <option value="single_side">single side</option>
                        </Select>
                      </Captioned>
                      {bandRoles.length > 1 && (
                        <Captioned label="Band role">
                          <Select
                            size="sm"
                            value={row.bandRole ?? ""}
                            onChange={(e) => patch(index, { bandRole: e.target.value as RoutineExercise["bandRole"] })}
                            aria-label="Band role"
                          >
                            {bandRoles.map((role) => (
                              <option key={role} value={role}>{role}</option>
                            ))}
                          </Select>
                        </Captioned>
                      )}
                    </div>
                    <Input
                      type="text"
                      value={row.notes}
                      onChange={(e) => patch(index, { notes: e.target.value })}
                      className="w-full"
                      placeholder="Notes"
                      aria-label="Notes"
                    />
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <div className="mt-4">
        <Button variant="primary" onClick={() => setPicker({ mode: "add" })}>
          <PlusIcon size={16} /> Add exercise
        </Button>
      </div>

      {/* Floating coverage toggle — sits clear of the mobile tab bar. */}
      <button
        type="button"
        onClick={() => setCoverageOpen(true)}
        className="fixed bottom-20 right-4 z-40 inline-flex min-h-11 items-center gap-2 rounded-full bg-accent-strong px-4 text-sm font-semibold text-accent-fg shadow-lg hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 md:bottom-6"
      >
        Coverage
      </button>

      {/* Coverage side sheet — quick reference without scrolling away. */}
      {coverageOpen && (
        <div
          className="fixed inset-0 z-50 bg-scrim"
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
            {/* One routine is one session — "neglected" only means something
                across a program's week, so that callout lives on the program page. */}
            <p className="mb-3 text-xs text-muted">Working sets per session of this routine.</p>
            <BodyHeatmap
              values={[...heat.values]}
              catalog={catalog}
              title="Body map"
              maxLabel={`${heat.max.toFixed(1)} sets/session`}
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
              ? exerciseLookup(catalog).exerciseById.get(
                  rows[picker.index].exerciseId,
                )?.pattern
              : undefined
          }
        />
      )}
    </div>
  );
}
