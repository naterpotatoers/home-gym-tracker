"use client";

import { useState } from "react";
import { ExercisePicker } from "@/components/exercise-picker";
import { CheckIcon, TrashIcon } from "@/components/icons";
import { FinishPanel, type FinishPayload } from "@/components/finish-panel";
import { RestReadyChips, SessionBlockList } from "@/components/session-block-list";
import { Button, ErrorText, NumberInput } from "@/components/ui";
import { useSessionClock } from "@/components/use-session-clock";
import { useSessionFlow } from "@/components/use-session-flow";
import { useSetEditor } from "@/components/use-set-editor";
import { useWakeLock } from "@/components/use-wake-lock";
import { discardSession, finishSession } from "@/lib/actions/workout";
import { exerciseLookup, type ExerciseCatalog } from "@/lib/exercise-catalog";
import type { Variant } from "@/lib/queries";
import type { RoutineExercise, Session, SetLog } from "@/lib/types";
import { errorMessage } from "@/lib/format";
import { completedCount } from "@/lib/session-labels";

type PickerTarget = { mode: "add" } | { mode: "replace"; index: number };

/**
 * The solo session runner — same flow as a group-board card (current-set
 * cursor, one-tap LOG, rest countdown, collapsed finished blocks) with solo
 * affordances: roomier set rows, a duration override, and a discard button.
 */
export function WorkoutRunner({
  session,
  initialSets,
  prescriptions,
  variants,
  catalog,
  clientName,
  recentKeys,
}: {
  session: Session;
  initialSets: SetLog[];
  prescriptions: RoutineExercise[];
  variants: Variant[];
  catalog: ExerciseCatalog;
  clientName: string;
  recentKeys?: string[];
}) {
  const editor = useSetEditor(session, initialSets);
  const clock = useSessionClock(session.id);
  const flow = useSessionFlow(editor, prescriptions, clock.now);
  useWakeLock();
  const [picker, setPicker] = useState<PickerTarget | null>(null);
  const [finishing, setFinishing] = useState(false);
  const [finishBusy, setFinishBusy] = useState(false);
  /** Manual minutes correction; null = trust the clock. */
  const [durationOverride, setDurationOverride] = useState<number | null>(null);

  const doneCount = completedCount(editor.sets);
  const durationMinutes = durationOverride ?? clock.elapsedMinutes;

  async function handleFinish(payload: FinishPayload) {
    setFinishBusy(true);
    editor.setError(null);
    try {
      await editor.flush();
      clock.clear();
      await finishSession(session.id, {
        durationMinutes: durationMinutes || null,
        ...payload,
      });
    } catch (e) {
      editor.setError(errorMessage(e, "Save failed."));
      setFinishBusy(false);
    }
  }

  async function handleDiscard() {
    if (!confirm("Discard this session? All logged sets are deleted.")) return;
    try {
      clock.clear();
      await discardSession(session.id);
    } catch (e) {
      editor.setError(errorMessage(e, "Discard failed."));
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-baseline gap-3">
        <h1 className="text-2xl font-bold tracking-tight">{clientName}</h1>
        <span className="text-sm text-muted">{session.date}</span>
        <span className="font-mono text-xs text-muted">
          {doneCount}/{editor.sets.length} sets · {clock.elapsedMinutes} min
        </span>
        <RestReadyChips flow={flow} />
        {editor.error && (
          <ErrorText>{editor.error}</ErrorText>
        )}
      </div>

      <div className="mt-6 rounded-xl border border-border bg-surface p-2 sm:p-3">
        <SessionBlockList
          editor={editor}
          flow={flow}
          prescriptions={prescriptions}
          catalog={catalog}
          onReplace={(block) => {
            const index = editor.blocks.indexOf(block);
            if (index >= 0) setPicker({ mode: "replace", index });
          }}
          onAdd={() => setPicker({ mode: "add" })}
        />
      </div>

      <div className="mt-8 border-t border-border pt-4">
        {finishing ? (
          <div className="space-y-4">
            <FinishPanel
              label="Finish session"
              busy={finishBusy}
              error={editor.error}
              onFinish={handleFinish}
              durationSlot={
                <label className="flex items-center gap-1 text-sm">
                  <NumberInput
                    value={durationMinutes}
                    min={0}
                    onChange={(v) => setDurationOverride(v ?? 0)}
                    className="w-20"
                  />
                  <span className="text-muted">min</span>
                </label>
              }
            />
            <Button variant="ghost" onClick={() => setFinishing(false)}>
              Back
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-4">
            <Button variant="primary" onClick={() => setFinishing(true)}>
              <CheckIcon size={16} /> Finish…
            </Button>
            <Button variant="danger" size="sm" onClick={handleDiscard}>
              <TrashIcon size={16} /> Discard session
            </Button>
          </div>
        )}
      </div>

      {picker !== null && (
        <ExercisePicker
          variants={variants}
          recentKeys={recentKeys}
          onSelect={async (variant) => {
            const target = picker;
            setPicker(null);
            if (target.mode === "add") {
              flow.onExerciseAdded(await editor.addExercise(variant));
            } else {
              editor.swapExercise(editor.blocks[target.index], variant);
            }
          }}
          onClose={() => setPicker(null)}
          emphasizePattern={
            picker.mode === "replace"
              ? exerciseLookup(catalog).exerciseById.get(
                  editor.blocks[picker.index].exerciseId,
                )?.pattern
              : undefined
          }
        />
      )}
    </div>
  );
}
