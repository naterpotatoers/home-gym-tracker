"use client";

import Link from "next/link";
import { useState } from "react";
import { EffortPicker } from "@/components/effort-picker";
import { PencilIcon, TrashIcon } from "@/components/icons";
import { ModalityChip } from "@/components/modality-chip";
import { ExercisePicker } from "@/components/exercise-picker";
import { Button, clientBorderStyle, IconButton, Input } from "@/components/ui";
import type { BoardPerson } from "@/components/group-board";
import { SetRow } from "@/components/set-row";
import { useSetEditor } from "@/components/use-set-editor";
import { finishSession } from "@/lib/actions/workout";
import { exerciseById } from "@/lib/data/exercises";
import type { Variant } from "@/lib/queries";
import { describeTarget, nextIncomplete, rxLabel } from "@/lib/session-labels";
import type { Block } from "@/lib/set-blocks";
import type { SessionCondition } from "@/lib/types";

/**
 * One person's live card on the group board, laid out as the session's
 * exercise list in performed order: finished blocks collapse into checked
 * rows that stack under the name, the current block is expanded in place
 * (big name, LOG, editable sets), upcoming blocks wait below. Tapping any
 * collapsed row — including a finished one — opens it for edits, so a wrong
 * weight logged three exercises ago is two taps away.
 */
export function GroupPersonCard({
  person,
  variants,
  now,
  boardElapsedMinutes,
  onFinished,
}: {
  person: BoardPerson;
  variants: Variant[];
  now: number;
  boardElapsedMinutes: number;
  onFinished: () => void;
}) {
  const { session, initialSets, prescriptions, clientName, routineName, color } = person;
  const editor = useSetEditor(session, initialSets);
  const [cursor, setCursor] = useState(() => {
    const first = initialSets.findIndex((s) => !s.completed);
    return first === -1 ? -1 : first;
  });
  /** Block explicitly opened by tap; null = follow the current block. */
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [swapBlock, setSwapBlock] = useState<Block | null>(null);
  const [restUntil, setRestUntil] = useState<number | null>(null);
  const [finishing, setFinishing] = useState(false);
  const [finishBusy, setFinishBusy] = useState(false);
  const [finished, setFinished] = useState(false);
  const [rpe, setRpe] = useState<number | null>(null);
  const [condition, setCondition] = useState<SessionCondition | null>(null);
  const [notes, setNotes] = useState("");

  // Self-healing cursor: if it points at a completed/removed set (jumps,
  // removals, external edits), fall back to the first incomplete set.
  const cursorValid =
    cursor >= 0 && cursor < editor.sets.length && !editor.sets[cursor].completed;
  const effectiveCursor = cursorValid ? cursor : nextIncomplete(editor.sets, 0);
  const current = effectiveCursor >= 0 ? editor.sets[effectiveCursor] : undefined;
  const currentBlock = current
    ? editor.blocks.find((b) => b.sets.some((s) => s.id === current.id))
    : undefined;
  const doneCount = editor.sets.filter((s) => s.completed).length;

  const shownKey = expandedKey ?? currentBlock?.key ?? null;

  const restSecondsLeft =
    restUntil !== null && now > 0 ? Math.ceil((restUntil - now) / 1000) : null;
  const resting = restSecondsLeft !== null && restSecondsLeft > 0;
  const ready = restSecondsLeft !== null && restSecondsLeft <= 0 && !finished;

  // The set after the current one — where the cursor lands after LOG.
  const upNextIndex = current
    ? nextIncomplete(
        editor.sets.map((s, i) => (i === effectiveCursor ? { ...s, completed: true } : s)),
        effectiveCursor + 1,
      )
    : -1;

  function logCurrent() {
    if (!current) return;
    const rx = prescriptions.find(
      (p) => p.exerciseId === current.exerciseId && p.modalityId === current.modalityId,
    );
    editor.patchSet(current.id, { completed: true });
    setRestUntil(rx ? Date.now() + rx.restSeconds * 1000 : null);
    setCursor(upNextIndex);
    setExpandedKey(null); // follow the flow to the next block
  }

  function tapBlock(block: Block) {
    // Upcoming block: move the workout there. Finished block: just open it
    // for edits without touching the LOG cursor. (There is no explicit
    // "skip" — tapping the next exercise IS the skip; unchecked sets never
    // count toward anything.)
    const firstIncomplete = block.sets.find((s) => !s.completed);
    if (firstIncomplete) {
      const index = editor.sets.findIndex((s) => s.id === firstIncomplete.id);
      if (index >= 0) setCursor(index);
      setExpandedKey(null); // it becomes the current block, which auto-expands
    } else {
      setExpandedKey(block.key === shownKey ? null : block.key);
    }
  }

  async function handleFinish() {
    setFinishBusy(true);
    editor.setError(null);
    try {
      await editor.flush();
      await finishSession(
        session.id,
        { durationMinutes: boardElapsedMinutes || null, notes, rpe, condition },
        null,
      );
      setFinished(true);
      onFinished();
    } catch (e) {
      editor.setError(e instanceof Error ? e.message : "Save failed.");
    } finally {
      setFinishBusy(false);
    }
  }

  if (finished) {
    return (
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-success/40 bg-success/10 px-4 py-3 text-sm">
        {color && (
          <span className="size-3 rounded-full" style={{ backgroundColor: color }} />
        )}
        <span className="font-semibold">{clientName}</span>
        <span className="text-muted">done · {doneCount} sets</span>
        {rpe !== null && (
          <span className="rounded bg-current/10 px-1.5 py-0.5 text-xs">RPE {rpe}</span>
        )}
        {condition && (
          <span className="rounded bg-current/10 px-1.5 py-0.5 text-xs">felt {condition}</span>
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
      className={`flex h-full flex-col rounded-xl border bg-surface p-3 transition-opacity ${
        ready ? "border-accent ring-1 ring-accent" : "border-border"
      } ${resting ? "opacity-70" : ""}`}
      style={ready ? undefined : clientBorderStyle(color)}
    >
      {/* Who + progress */}
      <div className="flex flex-wrap items-center gap-2 pb-2">
        {color && (
          <span className="size-3 rounded-full" style={{ backgroundColor: color }} />
        )}
        <span className="font-semibold">{clientName}</span>
        <span className="text-xs text-muted">{routineName}</span>
        <span className="ml-auto font-mono text-xs text-muted">
          {doneCount}/{editor.sets.length}
        </span>
        {resting && (
          <span className="font-mono text-xs text-warning-text">
            rest {Math.floor(restSecondsLeft / 60)}:{String(restSecondsLeft % 60).padStart(2, "0")}
          </span>
        )}
        {ready && <span className="text-xs font-semibold text-success-text">ready</span>}
      </div>

      {/* The session as a list you work down: done ✓ rows pile up on top,
          the open block expands in place, the rest wait below. */}
      <ul>
        {editor.blocks.map((block) => {
          const exercise = exerciseById.get(block.exerciseId);
          const done = block.sets.filter((s) => s.completed).length;
          const blockDone = done === block.sets.length;
          const isCurrent = block === currentBlock;
          const isExpanded = block.key === shownKey;
          const rx = prescriptions.find(
            (p) => p.exerciseId === block.exerciseId && p.modalityId === block.modalityId,
          );

          if (!isExpanded) {
            return (
              <li key={block.key} className="border-t border-border first:border-t-0">
                <button
                  type="button"
                  onClick={() => tapBlock(block)}
                  className={`flex min-h-10 w-full cursor-pointer items-center gap-2 rounded-md px-1 text-left text-sm hover:bg-current/5 ${
                    blockDone ? "text-muted" : ""
                  }`}
                >
                  <span
                    className={`font-mono text-xs ${blockDone ? "text-success-text" : "text-muted"}`}
                  >
                    {blockDone ? "✓" : `${done}/${block.sets.length}`}
                  </span>
                  <span className={`truncate ${blockDone ? "line-through decoration-current/40" : ""}`}>
                    {exercise?.name ?? block.exerciseId}
                  </span>
                  <span className="ml-auto text-xs text-muted">
                    {blockDone ? "tap to adjust" : ""}
                  </span>
                </button>
              </li>
            );
          }

          return (
            <li key={block.key} className="border-t border-border py-2 first:border-t-0">
              {/* Expanded header — tap collapses a manually opened block */}
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => !isCurrent && setExpandedKey(null)}
                  className={`flex min-w-0 flex-1 flex-wrap items-center gap-2 text-left ${
                    isCurrent ? "cursor-default" : "cursor-pointer"
                  }`}
                >
                  <h3
                    className={
                      isCurrent
                        ? "text-xl font-bold tracking-tight"
                        : "text-base font-semibold"
                    }
                  >
                    {exercise?.name ?? block.exerciseId}
                  </h3>
                  <ModalityChip modalityId={block.modalityId} />
                  {blockDone && (
                    <span className="font-mono text-xs text-success-text">✓ done</span>
                  )}
                  {!isCurrent && <span className="text-xs text-muted">▴</span>}
                </button>
                <IconButton
                  variant="ghost"
                  size="sm"
                  onClick={() => setSwapBlock(block)}
                  aria-label="Replace exercise"
                  title="Replace exercise"
                >
                  <PencilIcon />
                </IconButton>
                <IconButton
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    if (confirm(`Remove ${exercise?.name ?? "this exercise"} from the session?`)) {
                      editor.removeBlock(block);
                    }
                  }}
                  aria-label="Remove exercise from session"
                  title="Remove exercise from session"
                >
                  <TrashIcon />
                </IconButton>
              </div>
              {rx && <p className="mt-0.5 text-xs text-muted">{rxLabel(rx)}</p>}

              {/* LOG hero — only where the workout actually is */}
              {isCurrent && current && (
                <div className="mt-2 flex items-stretch gap-2">
                  <div className="flex min-h-10 flex-1 items-center rounded-md border-2 border-warning/70 bg-warning/5 px-3">
                    <span className="text-xs text-muted">
                      Set {current.setNumber}&nbsp;·&nbsp;
                    </span>
                    <span className="font-mono text-sm font-semibold">
                      {describeTarget(current)}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={logCurrent}
                    disabled={editor.busy}
                    className="min-h-10 cursor-pointer rounded-md border border-accent/50 px-4 text-sm font-bold tracking-wide text-accent-text hover:bg-accent/10 disabled:opacity-50"
                  >
                    LOG
                  </button>
                </div>
              )}

              {/* Editable sets */}
              <div className="mt-1.5">
                {block.sets.map((set) => (
                  <SetRow
                    key={set.id}
                    set={set}
                    dense
                    metricType={exercise?.metricType ?? "reps"}
                    onChange={(changes) => editor.patchSet(set.id, changes)}
                    onRemove={() => editor.removeSet(set.id)}
                  />
                ))}
                <div className="mt-1 flex justify-end">
                  <Button size="sm" onClick={() => editor.addSet(block)}>
                    + Add set
                  </Button>
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      {!current && (
        <p className="mt-2 text-sm text-success-text">All sets done — finish below.</p>
      )}

      {/* Footer — pinned to the card bottom so cards in a row line up */}
      <div className="mt-auto flex items-center gap-2 border-t border-border pt-2">
        {editor.error && (
          <span className="text-xs font-semibold text-danger-text">{editor.error}</span>
        )}
        <Button
          size="sm"
          variant="primary"
          onClick={() => setFinishing((v) => !v)}
          aria-expanded={finishing}
          className="ml-auto mt-2"
        >
          Finish {finishing ? "▴" : "…"}
        </Button>
      </div>

      {/* Inline finish panel */}
      {finishing && (
        <div className="mt-3 space-y-3 border-t border-border pt-3">
          <EffortPicker
            rpe={rpe}
            condition={condition}
            onChange={(patch) => {
              if (patch.rpe !== undefined) setRpe(patch.rpe);
              if (patch.condition !== undefined) setCondition(patch.condition);
            }}
          />
          <div className="flex flex-wrap items-center gap-2">
            <Input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Notes"
              className="min-w-48 flex-1"
            />
            <Button variant="primary" onClick={handleFinish} disabled={finishBusy}>
              {finishBusy ? "Saving…" : `Finish ${clientName}`}
            </Button>
          </div>
        </div>
      )}

      {swapBlock && (
        <ExercisePicker
          variants={variants}
          onSelect={(variant) => {
            const block = swapBlock;
            setSwapBlock(null);
            editor.swapExercise(block, variant);
          }}
          onClose={() => setSwapBlock(null)}
          emphasizePattern={exerciseById.get(swapBlock.exerciseId)?.pattern}
        />
      )}
    </div>
  );
}
