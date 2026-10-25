"use client";

import { useMemo, useState } from "react";
import { BodyHeatmap } from "@/components/body-heatmap";
import { ConfirmDeleteButton } from "@/components/confirm-delete-button";
import { PlusIcon, SaveIcon, TrashIcon } from "@/components/icons";
import {
  Button,
  Caret,
  Card,
  Checkbox,
  ErrorText,
  Field,
  IconButton,
  Input,
  Note,
  NumberInput,
  Select,
  summaryClass,
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
  METRIC_LABELS,
  METRIC_ORDER,
  PATTERN_LABELS,
  PATTERN_ORDER,
  roleForScore,
  SCORE_ROLES,
  scoreForRole,
  type ExerciseCatalog,
  type ScoreRole,
} from "@/lib/exercise-catalog";
import { nameKey, normalizeName } from "@/lib/names";
import { BAND_ROLES, UNILATERAL_MODES } from "@/lib/validate";
import { errorMessage } from "@/lib/format";
import type { HeatValue } from "@/lib/heat";
import type {
  Exercise,
  ExerciseModality,
  ExerciseMuscleScore,
  MetricType,
  MovementPattern,
  MuscleId,
  UnilateralMode,
} from "@/lib/types";
import { useUnsavedGuard } from "./unsaved-guard";

type ScoreRow = { muscleId: MuscleId; role: ScoreRole };
type VariantRow = Omit<ExerciseModality, "exerciseId">;

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
    implements: row.implements,
    loadIncludesBodyweight: row.loadIncludesBodyweight,
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
  const [aliasText, setAliasText] = useState((exercise.aliases ?? []).join(", "));
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

  // Dirty = the form differs from what was last loaded or saved. Derived from
  // a snapshot (not an "edited" flag) so undoing an edit counts as clean.
  const snapshot = JSON.stringify({
    name,
    aliasText,
    pattern,
    metricType,
    isCompound,
    scores,
    variants,
  });
  const [savedSnapshot, setSavedSnapshot] = useState(snapshot);
  const dirty = !readOnly && snapshot !== savedSnapshot;
  useUnsavedGuard(dirty);
  const status =
    saveState === "saving"
      ? "Saving…"
      : dirty
        ? "Unsaved changes"
        : saveState === "saved"
          ? "Saved"
          : "";

  const { scoresByExercise } = exerciseLookup(catalog);
  const sortedExercises = useMemo(
    () => [...catalog.exercises].sort((a, b) => a.name.localeCompare(b.name)),
    [catalog],
  );

  const primaryCount = scores.filter((s) => s.role === "primary").length;
  const usedMuscles = new Set(scores.map((s) => s.muscleId));
  const usedModalities = new Set(variants.map((v) => v.modalityId));
  const referenceName =
    catalog.exercises.find((e) => e.id === referenceId)?.name ?? referenceId;

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

  /** Copy the compared exercise's profile as a starting state — optional; a
   *  blank slate stays fully supported. Confirms before overwriting work. */
  function copyFromReference() {
    if (!referenceId) return;
    if (
      (scores.length > 0 || variants.length > 0) &&
      !window.confirm(
        `Replace this exercise's muscles and variants with ${referenceName}'s?`,
      )
    ) {
      return;
    }
    setScores(toScoreRows(scoresByExercise.get(referenceId) ?? []));
    setVariants(
      toVariantRows(exerciseLookup(catalog).modalitiesByExercise.get(referenceId) ?? []),
    );
  }

  /** Removing the default hands the role to the first remaining row — the
   *  save requires exactly one default. */
  function removeVariant(index: number) {
    setVariants((prev) => {
      const next = prev.filter((_, i) => i !== index);
      if (next.length > 0 && !next.some((v) => v.isDefault)) {
        next[0] = { ...next[0], isDefault: true };
      }
      return next;
    });
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
        implements: null,
        loadIncludesBodyweight: false,
        notes: "",
      },
    ]);
  }

  async function handleSave() {
    setError(null);
    setSaveState("saving");
    try {
      const seenAliases = new Set<string>();
      const aliases: string[] = [];
      for (const raw of aliasText.split(",")) {
        const alias = normalizeName(raw);
        const key = nameKey(alias);
        if (!alias || seenAliases.has(key)) continue;
        seenAliases.add(key);
        aliases.push(alias);
      }
      const payload: ExercisePayload = {
        name,
        aliases,
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
      setSavedSnapshot(snapshot);
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
            {METRIC_ORDER.map((metric) => (
              <option key={metric} value={metric}>
                {METRIC_LABELS[metric]}
              </option>
            ))}
          </Select>
        </Field>
        <div className="col-span-2 sm:col-span-3">
          <Field label="Also known as (comma-separated)">
            <Input
              type="text"
              value={aliasText}
              onChange={(e) => setAliasText(e.target.value)}
              disabled={readOnly}
              placeholder="Overhead Press, OHP"
              className="w-full"
            />
          </Field>
        </div>
        <label className="col-span-2 flex min-h-11 items-center gap-2 text-sm sm:col-span-3">
          <Checkbox
            checked={isCompound}
            onChange={(e) => setIsCompound(e.target.checked)}
            disabled={readOnly}
          />
          Compound (multi-joint) movement
        </label>
      </div>

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
        {/* Two columns of muscle rows on iPad landscape and up. */}
        <ul className="mt-2 grid gap-2 lg:grid-cols-2 lg:gap-x-6">
          {scores.map((row, index) => (
            <li key={row.muscleId} className="flex items-center gap-2">
              <Select
                size="sm"
                value={row.muscleId}
                onChange={(e) => patchScore(index, { muscleId: e.target.value as MuscleId })}
                disabled={readOnly}
                className="min-w-0 flex-1"
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
        <div className="mt-4 grid gap-6 sm:grid-cols-2">
          {scores.length > 0 ? (
            <BodyHeatmap
              values={[...previewValues]}
              catalog={catalog}
              title={`${name || "This exercise"} (preview)`}
              maxLabel="score 10"
            />
          ) : (
            <Note>Add a muscle to preview this exercise on the body map.</Note>
          )}
          <div>
            <div className="flex flex-wrap items-end gap-2">
              <Field label="Compare with">
                <Select
                  value={referenceId}
                  onChange={(e) => setReferenceId(e.target.value)}
                >
                  <option value="">— pick an exercise —</option>
                  {sortedExercises
                    .filter((e) => e.id !== exercise.id)
                    .map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.name}
                      </option>
                    ))}
                </Select>
              </Field>
              {!readOnly && (
                <Button onClick={copyFromReference} disabled={!referenceId}>
                  Copy its muscles &amp; variants
                </Button>
              )}
            </div>
            {referenceId && (
              <div className="mt-2">
                <BodyHeatmap
                  values={[...referenceValues]}
                  catalog={catalog}
                  title={referenceName}
                  maxLabel="score 10"
                />
              </div>
            )}
          </div>
        </div>
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
                      ...(e.target.value !== "dumbbell" && {
                        implements: null,
                        loadIncludesBodyweight: false,
                      }),
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
                <label className="flex min-h-11 items-center gap-1.5 text-sm">
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
                  Default
                </label>
                {!readOnly && (
                  <IconButton
                    variant="ghost"
                    size="sm"
                    className="ml-auto"
                    onClick={() => removeVariant(index)}
                    aria-label={`Remove ${
                      modalities.find((m) => m.id === variant.modalityId)?.name ??
                      variant.modalityId
                    } variant`}
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
                        className={`min-h-9 pointer-coarse:min-h-11 cursor-pointer rounded-full border px-2.5 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 disabled:cursor-default ${
                          on
                            ? "border-accent bg-accent-soft font-semibold text-accent-text"
                            : "border-border text-muted hover:bg-current/5"
                        }`}
                      >
                        {item.name}
                      </button>
                    );
                  })}
                </div>
              </div>

              {variant.modalityId === "band" && (
                <div className="mt-2 flex flex-wrap items-center gap-x-3">
                  <span className="text-[11px] uppercase tracking-wide text-muted">
                    Band roles
                  </span>
                  {BAND_ROLES.map((role) => (
                    <label key={role} className="flex min-h-11 items-center gap-1.5 text-sm">
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

              {/* Rarely-touched knobs stay folded so the card reads at a glance. */}
              <details className="group mt-2 rounded-md border border-border">
                <summary className={summaryClass("rounded-md px-2 text-sm")}>
                  <Caret /> Advanced
                </summary>
                {/* A disabled fieldset covers controls without their own
                    disabled prop (NumberInput) when the catalog is read-only. */}
                <fieldset
                  disabled={readOnly}
                  className="m-0 min-w-0 space-y-2 border-0 border-t border-border p-2"
                >
                  <div className="flex flex-wrap items-end gap-3">
                    <Field label="Unilateral mode">
                      <Select
                        size="sm"
                        value={variant.defaultUnilateralMode}
                        onChange={(e) =>
                          patchVariant(index, {
                            defaultUnilateralMode: e.target.value as UnilateralMode,
                          })
                        }
                      >
                        {UNILATERAL_MODES.map((mode) => (
                          <option key={mode} value={mode}>
                            {mode.replace("_", " ")}
                          </option>
                        ))}
                      </Select>
                    </Field>
                    <label className="flex min-h-11 items-center gap-1.5 text-sm">
                      <Checkbox
                        checked={variant.pinRisk}
                        onChange={(e) => patchVariant(index, { pinRisk: e.target.checked })}
                      />
                      Pin risk
                    </label>
                  </div>

                  {variant.modalityId === "dumbbell" && (
                    <div className="flex flex-wrap items-end gap-3">
                      <Field label="Dumbbells per rep">
                        <Select
                          value={variant.implements === null ? "" : String(variant.implements)}
                          onChange={(e) =>
                            patchVariant(index, {
                              implements:
                                e.target.value === ""
                                  ? null
                                  : (Number(e.target.value) as 1 | 2),
                            })
                          }
                        >
                          <option value="">Auto (from unilateral mode)</option>
                          <option value="1">One</option>
                          <option value="2">Two</option>
                        </Select>
                      </Field>
                      <label className="flex min-h-11 items-center gap-1.5 text-sm">
                        <Checkbox
                          checked={variant.loadIncludesBodyweight}
                          onChange={(e) =>
                            patchVariant(index, { loadIncludesBodyweight: e.target.checked })
                          }
                        />
                        Load includes bodyweight
                      </label>
                    </div>
                  )}

                  <div className="flex flex-wrap items-end gap-3">
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
                          placeholder="—"
                          className="w-full"
                        />
                      </Field>
                    </div>
                  </div>
                </fieldset>
              </details>
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

      {/* Save / delete — sticky so Save is always reachable on a long form;
          below md it rides above the fixed bottom tab bar. */}
      {!readOnly && (
        <div className="sticky bottom-[calc(4rem+env(safe-area-inset-bottom))] z-30 -mx-4 -mb-4 mt-5 flex flex-wrap items-center gap-2 rounded-b-xl border-t border-border bg-surface px-4 py-3 md:bottom-0">
          <Button
            variant="primary"
            onClick={handleSave}
            disabled={saveState === "saving"}
          >
            <SaveIcon size={16} /> Save exercise
          </Button>
          <span role="status" className="text-sm text-muted">
            {status}
          </span>
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
