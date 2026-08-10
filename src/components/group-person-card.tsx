"use client";

import Link from "next/link";
import { useState } from "react";
import { ExercisePicker } from "@/components/exercise-picker";
import { FinishPanel, type FinishPayload } from "@/components/finish-panel";
import { CheckIcon } from "@/components/icons";
import { RestReadyChips, SessionBlockList } from "@/components/session-block-list";
import { Button, clientBorderStyle, ColorDot, ErrorText } from "@/components/ui";
import type { BoardPerson } from "@/components/group-board";
import { useSessionFlow } from "@/components/use-session-flow";
import { useSetEditor } from "@/components/use-set-editor";
import { finishSession } from "@/lib/actions/workout";
import { exerciseLookup, type ExerciseCatalog } from "@/lib/exercise-catalog";
import type { Variant } from "@/lib/queries";
import type { Block } from "@/lib/set-blocks";
import { errorMessage } from "@/lib/format";

type PickerTarget = { mode: "add" } | { mode: "replace"; block: Block };

/**
 * One person's live card on the group board: header (name, progress, rest
 * state) around the shared SessionBlockList + FinishPanel. All session-flow
 * logic lives in useSessionFlow; this card is layout and the finish workflow.
 */
export function GroupPersonCard({
  person,
  variants,
  catalog,
  now,
  boardElapsedMinutes,
  onFinished,
}: {
  person: BoardPerson;
  variants: Variant[];
  catalog: ExerciseCatalog;
  now: number;
  boardElapsedMinutes: number;
  onFinished: () => void;
}) {
  const { session, initialSets, prescriptions, clientName, routineName, color } = person;
  const editor = useSetEditor(session, initialSets);
  const flow = useSessionFlow(editor, prescriptions, now);
  const [picker, setPicker] = useState<PickerTarget | null>(null);
  const [finishing, setFinishing] = useState(false);
  const [finishBusy, setFinishBusy] = useState(false);
  /** Set once the session is saved as completed — holds the recap payload. */
  const [finishedAs, setFinishedAs] = useState<FinishPayload | null>(null);

  const doneCount = editor.sets.filter((s) => s.completed).length;
  const finished = finishedAs !== null;
  const resting = flow.resting && !finished;
  const ready = flow.ready && !finished;

  async function handleFinish(payload: FinishPayload) {
    setFinishBusy(true);
    editor.setError(null);
    try {
      await editor.flush();
      await finishSession(
        session.id,
        { durationMinutes: boardElapsedMinutes || null, ...payload },
        null,
      );
      setFinishedAs(payload);
      onFinished();
    } catch (e) {
      editor.setError(errorMessage(e, "Save failed."));
    } finally {
      setFinishBusy(false);
    }
  }

  if (finishedAs) {
    return (
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-success/40 bg-success/10 px-4 py-3 text-sm">
        <ColorDot color={color} size="md" />
        <span className="font-semibold">{clientName}</span>
        <span className="text-muted">done · {doneCount} sets</span>
        {finishedAs.rpe !== null && (
          <span className="rounded bg-current/10 px-1.5 py-0.5 text-xs">
            RPE {finishedAs.rpe}
          </span>
        )}
        {finishedAs.condition && (
          <span className="rounded bg-current/10 px-1.5 py-0.5 text-xs">
            felt {finishedAs.condition}
          </span>
        )}
        <Link
          href={`/workout/session/${session.id}`}
          className="ml-auto text-xs text-accent-text underline underline-offset-2"
        >
          recap
        </Link>
      </div>
    );
  }

  return (
    <div
      className={`flex h-full flex-col rounded-xl border bg-surface p-2 transition-opacity sm:p-3 ${
        ready ? "border-accent ring-1 ring-accent" : "border-border"
      } ${resting ? "opacity-70" : ""}`}
      style={ready ? undefined : clientBorderStyle(color)}
    >
      {/* Who + progress */}
      <div className="flex flex-wrap items-center gap-2 pb-2">
        <ColorDot color={color} size="md" />
        <span className="font-semibold">{clientName}</span>
        <span className="text-xs text-muted">{routineName}</span>
        <span className="ml-auto font-mono text-xs text-muted">
          {doneCount}/{editor.sets.length}
        </span>
        <RestReadyChips flow={flow} />
      </div>

      <SessionBlockList
        editor={editor}
        flow={flow}
        prescriptions={prescriptions}
        catalog={catalog}
        dense
        onReplace={(block) => setPicker({ mode: "replace", block })}
        onAdd={() => setPicker({ mode: "add" })}
      />

      {/* Footer — pinned to the card bottom so cards in a row line up */}
      <div className="mt-auto flex items-center gap-2 border-t border-border pt-2">
        {editor.error && !finishing && (
          <ErrorText>{editor.error}</ErrorText>
        )}
        <Button
          size="sm"
          variant="primary"
          onClick={() => setFinishing((v) => !v)}
          aria-expanded={finishing}
          className="ml-auto mt-2"
        >
          <CheckIcon size={14} /> Finish {finishing ? "▴" : "…"}
        </Button>
      </div>

      {/* Inline finish panel */}
      {finishing && (
        <div className="mt-3 border-t border-border pt-3">
          <FinishPanel
            label={`Finish ${clientName}`}
            busy={finishBusy}
            error={editor.error}
            onFinish={handleFinish}
          />
        </div>
      )}

      {picker && (
        <ExercisePicker
          variants={variants}
          recentKeys={person.recentKeys}
          onSelect={async (variant) => {
            const target = picker;
            setPicker(null);
            if (target.mode === "add") {
              flow.onExerciseAdded(await editor.addExercise(variant));
            } else {
              editor.swapExercise(target.block, variant);
            }
          }}
          onClose={() => setPicker(null)}
          emphasizePattern={
            picker.mode === "replace"
              ? exerciseLookup(catalog).exerciseById.get(picker.block.exerciseId)
                  ?.pattern
              : undefined
          }
        />
      )}
    </div>
  );
}
