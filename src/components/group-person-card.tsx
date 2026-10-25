"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ExercisePicker } from "@/components/exercise-picker";
import { FinishPanel, type FinishPayload } from "@/components/finish-panel";
import { CheckIcon } from "@/components/icons";
import { RestReadyChips, SessionBlockList } from "@/components/session-block-list";
import { Button, clientBorderStyle, ColorDot, ErrorText } from "@/components/ui";
import type { BoardPerson, CardStatus } from "@/components/group-board";
import { useSessionFlow } from "@/components/use-session-flow";
import { useSetEditor } from "@/components/use-set-editor";
import { finishSession } from "@/lib/actions/workout";
import { exerciseLookup, type ExerciseCatalog } from "@/lib/exercise-catalog";
import type { Variant } from "@/lib/queries";
import type { Block } from "@/lib/set-blocks";
import { errorMessage } from "@/lib/format";
import { completedCount } from "@/lib/session-labels";

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
  boardSessionIds,
  onFinished,
  onStatus,
  tight = false,
}: {
  person: BoardPerson;
  variants: Variant[];
  catalog: ExerciseCatalog;
  now: number;
  boardElapsedMinutes: number;
  /** Every session on this board — the recap link carries them back. */
  boardSessionIds: string;
  onFinished: () => void;
  /** Progress + rest state, for the board's portrait person tabs. */
  onStatus: (sessionId: string, status: CardStatus) => void;
  /** Three-plus across the board: trim the card padding at every width. */
  tight?: boolean;
}) {
  const pad = tight ? "p-2" : "p-2 sm:p-3";
  const bleed = tight ? "-mx-2 px-2" : "-mx-2 px-2 sm:-mx-3 sm:px-3";
  const { session, initialSets, prescriptions, clientName, routineName, color } = person;
  const editor = useSetEditor(session, initialSets);
  const flow = useSessionFlow(editor, prescriptions, now);
  const [picker, setPicker] = useState<PickerTarget | null>(null);
  const [finishing, setFinishing] = useState(false);
  const [finishBusy, setFinishBusy] = useState(false);
  /** Set once the session is saved as completed — holds the recap payload. */
  const [finishedHere, setFinishedHere] = useState<FinishPayload | null>(null);
  // A session finished before this page rendered (reload, revisit) recaps
  // from the stored check-in.
  const finishedAs: Pick<FinishPayload, "rpe" | "condition"> | null =
    finishedHere ??
    (person.finished ? { rpe: session.rpe, condition: session.condition } : null);

  const doneCount = completedCount(editor.sets);
  // Finish is the loud button only once there's nothing left to log.
  const allDone = !flow.current;
  const finished = finishedAs !== null;
  const resting = flow.resting && !finished;
  const ready = flow.ready && !finished;

  const total = editor.sets.length;
  useEffect(() => {
    onStatus(session.id, { done: doneCount, total, resting, ready, finished });
  }, [onStatus, session.id, doneCount, total, resting, ready, finished]);

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
      setFinishedHere(payload);
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
          href={`/workout/session/${session.id}?board=${encodeURIComponent(boardSessionIds)}`}
          className="ml-auto inline-flex min-h-11 items-center px-2 text-xs text-accent-text underline underline-offset-2"
        >
          recap
        </Link>
      </div>
    );
  }

  return (
    <div
      className={`flex h-full flex-col rounded-xl border bg-surface ${pad} ${
        ready ? "border-accent ring-1 ring-accent" : "border-border"
      }`}
      style={ready ? undefined : clientBorderStyle(color)}
    >
      {/* Who + progress — only this dims while resting, so the sets stay
          readable (and editable) between sets. */}
      <div
        className={`flex items-center gap-2 pb-2 transition-opacity ${
          resting ? "opacity-70" : ""
        }`}
      >
        <ColorDot color={color} size="md" />
        <span className="font-semibold">{clientName}</span>
        <span className="min-w-0 flex-1 truncate text-xs text-muted">{routineName}</span>
        <span className="shrink-0 font-mono text-xs text-muted">
          {doneCount}/{editor.sets.length}
        </span>
        <RestReadyChips flow={flow} />
      </div>

      <SessionBlockList
        editor={editor}
        flow={flow}
        prescriptions={prescriptions}
        catalog={catalog}
        history={person.history}
        dense
        onReplace={(block) => setPicker({ mode: "replace", block })}
        onAdd={() => setPicker({ mode: "add" })}
      />

      {/* Footer — at the card bottom so cards in a row line up, and sticky to
          the viewport bottom so Finish is reachable from anywhere in a long
          card. Negative margins let its background cover the card padding. */}
      <div
        className={`sticky bottom-0 z-10 mt-auto flex items-center gap-2 border-t border-border bg-surface pt-1.5 pb-[max(0.375rem,env(safe-area-inset-bottom))] ${bleed}`}
      >
        {editor.error && !finishing && (
          <ErrorText>{editor.error}</ErrorText>
        )}
        <Button
          size="sm"
          variant={allDone ? "primary" : "ghost"}
          onClick={() => setFinishing((v) => !v)}
          aria-expanded={finishing}
          className="ml-auto"
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
          inSession
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
