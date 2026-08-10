"use client";

import { useMemo, useState } from "react";
import { BodyHeatmap } from "@/components/body-heatmap";
import { ConfirmDeleteButton } from "@/components/confirm-delete-button";
import { PlusIcon, SaveIcon, TrashIcon } from "@/components/icons";
import {
  Button,
  Card,
  Checkbox,
  ErrorText,
  Field,
  IconButton,
  Input,
  Note,
  NumberInput,
  Select,
} from "@/components/ui";
import {
  deleteExercise,
  saveExercise,
  type ExercisePayload,
} from "@/lib/actions/exercises";
import { equipment } from "@/lib/data/equipment";
import { modalities } from "@/lib/data/modalities";
import { muscleById, muscles } from "@/lib/data/muscles";
import {
  exerciseLookup,
  MAX_PRIMARY_MUSCLES,
  MAX_SCORED_MUSCLES,
  PATTERN_LABELS,
  PATTERN_ORDER,
  roleForScore,
  SCORE_ROLES,
  scoreForRole,
  type ExerciseCatalog,
  type ScoreRole,
} from "@/lib/exercise-catalog";
import { errorMessage } from "@/lib/format";
import type { HeatValue } from "@/lib/heat";
import type {
  BandRole,
  EquipmentId,
  Exercise,
  ExerciseModality,
  ExerciseMuscleScore,
  MetricType,
  MovementPattern,
  MuscleId,
  UnilateralMode,
} from "@/lib/types";

type ScoreRow = { muscleId: MuscleId; role: ScoreRole };
type VariantRow = Omit<ExerciseModality, "exerciseId">;

const BAND_ROLES: readonly BandRole[] = ["resistance", "assistance"];
const UNILATERAL_MODES: readonly UnilateralMode[] = [
  "bilateral",
  "alternating",
  "single_side",
];

function toScoreRows(scores: readonly ExerciseMuscleScore[]): ScoreRow[] {
  return scores.map((s) => ({ muscleId: s.muscleId, role: roleForScore(s.score) }));
}

function toVariantRows(rows: readonly ExerciseModality[]): VariantRow[] {
  return rows.map((row) => ({
    modalityId: row.modalityId,
    isDefault: row.isDefault,
    bandRoles: row.bandRoles,
    defaultUnilateralMode: row.defaultUnilateralMode,
    requiredEquipment: row.requiredEquipment,
    pinRisk: row.pinRisk,
    loadFactorOverride: row.loadFactorOverride,
    notes: row.notes,
  }));
}

function heatFromScores(rows: readonly { muscleId: MuscleId; score: number }[]) {
  const values = new Map<MuscleId, HeatValue>();
  for (const row of rows) {
    values.set(row.muscleId, {
      intensity: row.score / 10,
      detail: `${muscleById.get(row.muscleId)?.name ?? row.muscleId} — score ${row.score}`,
      ordinalOnly: false,
    });
  }
  return values;
}

/**
 * Full authoring for one exercise: basics, muscle roles, and modality
 * variants, with an explicit Save. Muscle work is authored as ROLES (primary/
 * secondary/supporting/stabilizer), not free 0–10 numbers — the guardrail
 * that keeps a hand-added exercise from claiming an inflated profile and
 * skewing the heat map. The live preview makes what you're claiming visible
 * next to a reference exercise before you save.
 */
export function ExerciseEditor({
  exercise,
  initialScores,
  initialModalities,
  catalog,
  readOnly,
}: {
  exercise: Exercise;
  initialScores: ExerciseMuscleScore[];
  initialModalities: ExerciseModality[];
  catalog: ExerciseCatalog;
  readOnly: boolean;
}) {
  const [name, setName] = useState(exercise.name);
  const [pattern, setPattern] = useState<MovementPattern>(exercise.pattern);
  const [metricType, setMetricType] = useState<MetricType>(exercise.metricType);
  const [isCompound, setIsCompound] = useState(exercise.isCompound);
  const [scores, setScores] = useState<ScoreRow[]>(toScoreRows(initialScores));
  const [variants, setVariants] = useState<VariantRow[]>(
    toVariantRows(initialModalities),
  );
  const [referenceId, setReferenceId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">("idle");

  const { scoresByExercise } = exerciseLookup(catalog);
  const sortedExercises = useMemo(
    () => [...catalog.exercises].sort((a, b) => a.name.localeCompare(b.name)),
    [catalog],
  );

  const primaryCount = scores.filter((s) => s.role === "primary").length;
  const usedMuscles = new Set(scores.map((s) => s.muscleId));
  const usedModalities = new Set(variants.map((v) => v.modalityId));

  const previewValues = useMemo(
    () =>
      heatFromScores(
        scores.map((s) => ({ muscleId: s.muscleId, score: scoreForRole(s.role) })),
      ),
    [scores],
  );
  const referenceValues = useMemo(
    () => heatFromScores(scoresByExercise.get(referenceId) ?? []),
    [scoresByExercise, referenceId],
  );

  /** Copy another exercise's profile as the starting state — optional; a
   *  blank slate stays fully supported. */
  function startFrom(sourceId: string) {
    if (!sourceId) return;
    setScores(toScoreRows(scoresByExercise.get(sourceId) ?? []));
    setVariants(
      toVariantRows(exerciseLookup(catalog).modalitiesByExercise.get(sourceId) ?? []),
    );
    setReferenceId(sourceId);
  }

  function patchScore(index: number, changes: Partial<ScoreRow>) {
    setScores((prev) =>
      prev.map((row, i) => (i === index ? { ...row, ...changes } : row)),
    );
  }

  function patchVariant(index: number, changes: Partial<VariantRow>) {
    setVariants((prev) =>
      prev.map((row, i) => (i === index ? { ...row, ...changes } : row)),
    );
  }

  function addScoreRow() {
    const next = muscles.find((m) => !usedMuscles.has(m.id));
    if (!next) return;
    setScores((prev) => [
      ...prev,
      { muscleId: next.id, role: prev.length === 0 ? "primary" : "supporting" },
    ]);
  }

  function addVariantRow() {
    const next = modalities.find((m) => !usedModalities.has(m.id));
    if (!next) return;
    setVariants((prev) => [
      ...prev,
      {
        modalityId: next.id,
        isDefault: prev.length === 0,
        bandRoles: [],
        defaultUnilateralMode: "bilateral",
        requiredEquipment: [],
        pinRisk: false,
        loadFactorOverride: null,
        notes: "",
      },
    ]);
  }

  async function handleSave() {
    setError(null);
    setSaveState("saving");
    try {
      const payload: ExercisePayload = {
        name,
        pattern,
        metricType,
        isCompound,
        scores: scores.map((s) => ({
          muscleId: s.muscleId,
          score: scoreForRole(s.role),
        })),
        modalities: variants,
      };
      await saveExercise(exercise.id, payload);
      setSaveState("saved");
    } catch (e) {
      setSaveState("idle");
      setError(errorMessage(e, "Save failed."));
    }
  }

  return (
    <Card className="mt-4">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-lg font-semibold">{exercise.name}</h2>
        <span className="font-mono text-xs text-muted">{exercise.id}</span>
        <span className="ml-auto text-xs text-muted">
          {saveState === "saving" ? "saving…" : saveState === "saved" ? "saved" : ""}
        </span>
      </div>

      {/* Basics */}
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className="col-span-2 sm:col-span-1">
          <Field label="Name">
            <Input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={readOnly}
              className="w-full"
            />
          </Field>
        </div>
        <Field label="Pattern">
          <Select
            value={pattern}
            onChange={(e) => setPattern(e.target.value as MovementPattern)}
            disabled={readOnly}
          >
            {PATTERN_ORDER.map((p) => (
              <option key={p} value={p}>
                {PATTERN_LABELS[p]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Measured by">
          <Select
            value={metricType}
            onChange={(e) => setMetricType(e.target.value as MetricType)}
            disabled={readOnly}
          >
            <option value="reps">Reps</option>
            <option value="time">Time</option>
            <option value="distance">Distance</option>
          </Select>
        </Field>
        <label className="col-span-2 flex min-h-11 items-center gap-2 text-sm sm:col-span-3">
          <Checkbox
            checked={isCompound}
            onChange={(e) => setIsCompound(e.target.checked)}
            disabled={readOnly}
          />
          Compound (multi-joint) movement
        </label>
      </div>

      {/* Start from template */}
      {!readOnly && (
        <div className="mt-5 flex flex-wrap items-end gap-3 border-t border-border pt-4">
          <Field label="Start from… (copies muscles & variants)">
            <Select value="" onChange={(e) => startFrom(e.target.value)}>
              <option value="">— from scratch —</option>
              {sortedExercises
                .filter((e) => e.id !== exercise.id)
                .map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.name}
                  </option>
                ))}
            </Select>
          </Field>
        </div>
      )}

      {/* Muscle roles */}
      <div className="mt-5 border-t border-border pt-4">
        <h3 className="text-sm font-semibold">Muscles worked</h3>
        <Note>
          Roles, not free numbers, keep the heat map honest: Primary (10) — the
          movement exists to train it, at most {MAX_PRIMARY_MUSCLES}; Secondary
          (7) — works hard every rep; Supporting (4) — assists; Stabilizer (2)
          — holds position.
        </Note>
        {pattern === "mobility" && (
          <Note>
            Mobility work carries no muscle scores on purpose — it&apos;s
            excluded from volume math entirely.
          </Note>
        )}
        <ul className="mt-2 space-y-2">
          {scores.map((row, index) => (
            <li key={row.muscleId} className="flex flex-wrap items-center gap-2">
              <Select
                size="sm"
                value={row.muscleId}
                onChange={(e) => patchScore(index, { muscleId: e.target.value as MuscleId })}
                disabled={readOnly}
              >
                {muscles
                  .filter((m) => m.id === row.muscleId || !usedMuscles.has(m.id))
                  .map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
              </Select>
              <Select
                size="sm"
                value={row.role}
                onChange={(e) => patchScore(index, { role: e.target.value as ScoreRole })}
                disabled={readOnly}
              >
                {SCORE_ROLES.map((r) => (
                  <option
                    key={r.role}
                    value={r.role}
                    disabled={
                      r.role === "primary" &&
                      row.role !== "primary" &&
                      primaryCount >= MAX_PRIMARY_MUSCLES
                    }
                  >
                    {r.label} ({r.score})
                  </option>
                ))}
              </Select>
              {!readOnly && (
                <IconButton
                  variant="ghost"
                  size="sm"
                  onClick={() => setScores((prev) => prev.filter((_, i) => i !== index))}
                  aria-label={`Remove ${muscleById.get(row.muscleId)?.name ?? row.muscleId}`}
                >
                  <TrashIcon size={16} />
                </IconButton>
              )}
            </li>
          ))}
        </ul>
        {!readOnly && (
          <Button
            size="sm"
            className="mt-2"
            onClick={addScoreRow}
            disabled={scores.length >= MAX_SCORED_MUSCLES}
          >
            <PlusIcon size={14} /> Add muscle
            {scores.length >= MAX_SCORED_MUSCLES && ` (max ${MAX_SCORED_MUSCLES})`}
          </Button>
        )}

        {/* Live preview vs a reference — skew is visible before saving. */}
        {scores.length > 0 && (
          <div className="mt-4 grid gap-6 sm:grid-cols-2">
            <BodyHeatmap
              values={previewValues}
              catalog={catalog}
              title={`${name || "This exercise"} (preview)`}
              maxLabel="score 10"
            />
            <div>
              <Field label="Compare against">
                <Select
                  size="sm"
                  value={referenceId}
                  onChange={(e) => setReferenceId(e.target.value)}
                >
                  <option value="">— pick a reference —</option>
                  {sortedExercises
                    .filter((e) => e.id !== exercise.id)
                    .map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.name}
                      </option>
                    ))}
                </Select>
              </Field>
              {referenceId && (
                <div className="mt-2">
                  <BodyHeatmap
                    values={referenceValues}
                    catalog={catalog}
                    title={
                      catalog.exercises.find((e) => e.id === referenceId)?.name ??
                      referenceId
                    }
                    maxLabel="score 10"
                  />
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Modality variants */}
      <div className="mt-5 border-t border-border pt-4">
        <h3 className="text-sm font-semibold">Variants (how it&apos;s loaded)</h3>
        <Note>
          One row per way to perform it. Without at least one variant the
          exercise can&apos;t be picked in a routine or session.
        </Note>
        <div className="mt-2 space-y-3">
          {variants.map((variant, index) => (
            <div
              key={variant.modalityId}
              className="rounded-xl border border-border bg-background p-3"
            >
              <div className="flex flex-wrap items-center gap-3">
                <Select
                  size="sm"
                  value={variant.modalityId}
                  onChange={(e) =>
                    patchVariant(index, {
                      modalityId: e.target.value as VariantRow["modalityId"],
                      bandRoles: e.target.value === "band" ? variant.bandRoles : [],
                    })
                  }
                  disabled={readOnly}
                >
                  {modalities
                    .filter(
                      (m) => m.id === variant.modalityId || !usedModalities.has(m.id),
                    )
                    .map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name}
                      </option>
                    ))}
                </Select>
                <label className="flex items-center gap-1.5 text-sm">
                  <input
                    type="radio"
                    name={`default-variant-${exercise.id}`}
                    checked={variant.isDefault}
                    onChange={() =>
                      setVariants((prev) =>
                        prev.map((v, i) => ({ ...v, isDefault: i === index })),
                      )
                    }
                    disabled={readOnly}
                    className="size-4 accent-(--color-accent)"
                  />
                  default
                </label>
                <label className="flex items-center gap-1.5 text-sm">
                  <Checkbox
                    checked={variant.pinRisk}
                    onChange={(e) => patchVariant(index, { pinRisk: e.target.checked })}
                    disabled={readOnly}
                  />
                  pin risk
                </label>
                <Select
                  size="sm"
                  value={variant.defaultUnilateralMode}
                  onChange={(e) =>
                    patchVariant(index, {
                      defaultUnilateralMode: e.target.value as UnilateralMode,
                    })
                  }
                  disabled={readOnly}
                >
                  {UNILATERAL_MODES.map((mode) => (
                    <option key={mode} value={mode}>
                      {mode.replace("_", " ")}
                    </option>
                  ))}
                </Select>
                {!readOnly && (
                  <IconButton
                    variant="ghost"
                    size="sm"
                    className="ml-auto"
                    onClick={() =>
                      setVariants((prev) => prev.filter((_, i) => i !== index))
                    }
                    aria-label="Remove variant"
                  >
                    <TrashIcon size={16} />
                  </IconButton>
                )}
              </div>

              <div className="mt-2">
                <span className="text-[11px] uppercase tracking-wide text-muted">
                  Needs equipment
                </span>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {equipment.map((item) => {
                    const on = variant.requiredEquipment.includes(item.id);
                    return (
                      <button
                        key={item.id}
                        type="button"
                        disabled={readOnly}
                        onClick={() =>
                          patchVariant(index, {
                            requiredEquipment: on
                              ? variant.requiredEquipment.filter((id) => id !== item.id)
                              : [...variant.requiredEquipment, item.id],
                          })
                        }
                        aria-pressed={on}
                        title={item.name}
                        className={`min-h-9 cursor-pointer rounded-full border px-2.5 text-xs ${
                          on
                            ? "border-accent bg-accent-soft font-semibold text-accent-text"
                            : "border-border text-muted hover:bg-current/5"
                        }`}
                      >
                        {(item.id as EquipmentId).replace(/_/g, " ")}
                      </button>
                    );
                  })}
                </div>
              </div>

              {variant.modalityId === "band" && (
                <div className="mt-2 flex flex-wrap items-center gap-3">
                  <span className="text-[11px] uppercase tracking-wide text-muted">
                    Band roles
                  </span>
                  {BAND_ROLES.map((role) => (
                    <label key={role} className="flex items-center gap-1.5 text-sm">
                      <Checkbox
                        checked={variant.bandRoles.includes(role)}
                        onChange={(e) =>
                          patchVariant(index, {
                            bandRoles: e.target.checked
                              ? [...variant.bandRoles, role]
                              : variant.bandRoles.filter((r) => r !== role),
                          })
                        }
                        disabled={readOnly}
                      />
                      {role}
                    </label>
                  ))}
                </div>
              )}

              <div className="mt-2 flex flex-wrap items-end gap-3">
                <Field label="Load factor override">
                  <NumberInput
                    size="sm"
                    value={variant.loadFactorOverride}
                    step={0.05}
                    min={0.05}
                    placeholder="—"
                    onChange={(v) => patchVariant(index, { loadFactorOverride: v })}
                  />
                </Field>
                <div className="min-w-48 flex-1">
                  <Field label="Notes">
                    <Input
                      type="text"
                      size="sm"
                      value={variant.notes}
                      onChange={(e) => patchVariant(index, { notes: e.target.value })}
                      disabled={readOnly}
                      placeholder="—"
                      className="w-full"
                    />
                  </Field>
                </div>
              </div>
            </div>
          ))}
        </div>
        {!readOnly && (
          <Button
            size="sm"
            className="mt-2"
            onClick={addVariantRow}
            disabled={usedModalities.size >= modalities.length}
          >
            <PlusIcon size={14} /> Add variant
          </Button>
        )}
      </div>

      {/* Save / delete */}
      {!readOnly && (
        <div className="mt-5 flex items-center gap-2 border-t border-border pt-4">
          <Button
            variant="primary"
            onClick={handleSave}
            disabled={saveState === "saving"}
          >
            <SaveIcon size={16} /> Save exercise
          </Button>
          {error && <ErrorText>{error}</ErrorText>}
          <ConfirmDeleteButton
            action={deleteExercise.bind(null, exercise.id)}
            confirmText={`Delete ${exercise.name}? Only possible while nothing has been logged or prescribed with it.`}
            ariaLabel={`Delete ${exercise.name}`}
            className="ml-auto text-danger-text"
          />
        </div>
      )}
    </Card>
  );
}
