"use client";

import { useEffect, useState } from "react";
import { EffortPicker } from "@/components/effort-picker";
import { Button, Input, NumberInput } from "@/components/ui";
import { ExercisePicker } from "@/components/exercise-picker";
import { SetRow } from "@/components/set-row";
import { useSetEditor } from "@/components/use-set-editor";
import { discardSession, finishSession } from "@/lib/actions/workout";
import { exerciseById } from "@/lib/data/exercises";
import { modalityById } from "@/lib/data/modalities";
import type { Variant } from "@/lib/queries";
import type { RoutineExercise, Session, SessionCondition, SetLog } from "@/lib/types";

export function WorkoutRunner({
  session,
  initialSets,
  prescriptions,
  variants,
  clientName,
}: {
  session: Session;
  initialSets: SetLog[];
  prescriptions: RoutineExercise[];
  variants: Variant[];
  clientName: string;
}) {
  const editor = useSetEditor(session, initialSets);
  const [swapTarget, setSwapTarget] = useState<number | null>(null);
  const [finishing, setFinishing] = useState(false);
  const [finishBusy, setFinishBusy] = useState(false);
  const [notes, setNotes] = useState("");
  const [rpe, setRpe] = useState<number | null>(null);
  const [condition, setCondition] = useState<SessionCondition | null>(null);
  const [elapsedMinutes, setElapsedMinutes] = useState(0);

  useEffect(() => {
    const startedAt = Date.now();
    const timer = setInterval(
      () => setElapsedMinutes(Math.floor((Date.now() - startedAt) / 60_000)),
      15_000,
    );
    return () => clearInterval(timer);
  }, []);

  async function handleFinish() {
    setFinishBusy(true);
    editor.setError(null);
    try {
      await editor.flush();
      await finishSession(session.id, {
        durationMinutes: elapsedMinutes || null,
        notes,
        rpe,
        condition,
      });
    } catch (e) {
      editor.setError(e instanceof Error ? e.message : "Save failed.");
      setFinishBusy(false);
    }
  }

  async function handleDiscard() {
    if (!confirm("Discard this session? All logged sets are deleted.")) return;
    try {
      await discardSession(session.id);
    } catch (e) {
      editor.setError(e instanceof Error ? e.message : "Discard failed.");
    }
  }

  const doneCount = editor.sets.filter((s) => s.completed).length;

  return (
    <div>
      <div className="flex flex-wrap items-baseline gap-3">
        <h1 className="text-2xl font-bold tracking-tight">{clientName}</h1>
        <span className="text-sm text-muted">{session.date}</span>
        <span className="font-mono text-xs text-muted">
          {doneCount}/{editor.sets.length} sets · {elapsedMinutes} min
        </span>
        {editor.error && <span className="text-xs font-semibold text-danger-text">{editor.error}</span>}
      </div>

      <div className="mt-6 space-y-6">
        {editor.blocks.map((block, blockIndex) => {
          const exercise = exerciseById.get(block.exerciseId);
          const rx = prescriptions.find(
            (p) => p.exerciseId === block.exerciseId && p.modalityId === block.modalityId,
          );
          return (
            <div key={block.key} className="rounded-xl border border-border bg-surface p-3">
              <div className="flex flex-wrap items-baseline gap-2">
                <h2 className="text-sm font-semibold">{exercise?.name ?? block.exerciseId}</h2>
                <span className="rounded bg-current/10 px-1.5 py-0.5 text-xs">
                  {modalityById.get(block.modalityId)?.name ?? block.modalityId}
                </span>
                {rx && (
                  <span className="text-xs text-muted">
                    {rx.durationSeconds !== null
                      ? `${rx.sets}×${rx.durationSeconds}s`
                      : rx.repMin === rx.repMax
                      ? `${rx.sets}×${rx.repMax ?? "?"}`
                      : `${rx.sets}×${rx.repMin ?? "?"}–${rx.repMax ?? "?"}`}
                    {rx.targetRir !== null && ` @ RIR ${rx.targetRir}`}
                    {` · rest ${rx.restSeconds}s`}
                  </span>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSwapTarget(blockIndex)}
                  className="ml-auto"
                >
                  Replace
                </Button>
              </div>

              <div className="mt-2 divide-y divide-border">
                {block.sets.map((set) => (
                  <SetRow
                    key={set.id}
                    set={set}
                    metricType={exercise?.metricType ?? "reps"}
                    onChange={(changes) => editor.patchSet(set.id, changes)}
                    onRemove={() => editor.removeSet(set.id)}
                  />
                ))}
              </div>

              <Button size="sm" onClick={() => editor.addSet(block)} className="mt-2">
                + Add set
              </Button>
            </div>
          );
        })}
      </div>

      <div className="mt-8 border-t border-border pt-4">
        {finishing ? (
          <div className="space-y-4">
            <EffortPicker
              rpe={rpe}
              condition={condition}
              onChange={(patch) => {
                if (patch.rpe !== undefined) setRpe(patch.rpe);
                if (patch.condition !== undefined) setCondition(patch.condition);
              }}
            />
            <div className="flex flex-wrap items-center gap-3">
              <label className="flex items-center gap-1 text-sm">
                <NumberInput
                  value={elapsedMinutes}
                  min={0}
                  onChange={(v) => setElapsedMinutes(v ?? 0)}
                  className="w-20"
                />
                <span className="text-muted">min</span>
              </label>
              <Input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Session notes"
                className="min-w-64 flex-1"
              />
              <Button variant="primary" onClick={handleFinish} disabled={finishBusy}>
                {finishBusy ? "Saving…" : "Finish session"}
              </Button>
              <Button variant="ghost" onClick={() => setFinishing(false)}>
                Back
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-4">
            <Button variant="primary" onClick={() => setFinishing(true)}>
              Finish…
            </Button>
            <Button variant="danger" size="sm" onClick={handleDiscard}>
              Discard session
            </Button>
          </div>
        )}
      </div>

      {swapTarget !== null && (
        <ExercisePicker
          variants={variants}
          onSelect={(variant) => {
            const block = editor.blocks[swapTarget];
            setSwapTarget(null);
            editor.swapExercise(block, variant);
          }}
          onClose={() => setSwapTarget(null)}
          emphasizePattern={
            exerciseById.get(editor.blocks[swapTarget].exerciseId)?.pattern
          }
        />
      )}
    </div>
  );
}
