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
import { advanceCursor, describeTarget, resolveCursor, rxLabel } from "@/lib/session-labels";
import type { Block } from "@/lib/set-blocks";
import type { SessionCondition } from "@/lib/types";

type PickerTarget = { mode: "add" } | { mode: "replace"; block: Block };

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
  const [cursorId, setCursorId] = useState<string | null>(
    () => initialSets.find((s) => !s.completed)?.id ?? null,
  );
  /** Block explicitly opened by tap; null = follow the current block. */
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [picker, setPicker] = useState<PickerTarget | null>(null);
  const [restUntil, setRestUntil] = useState<number | null>(null);
  const [finishing, setFinishing] = useState(false);
  const [finishBusy, setFinishBusy] = useState(false);
  const [finished, setFinished] = useState(false);
  const [rpe, setRpe] = useState<number | null>(null);
  const [condition, setCondition] = useState<SessionCondition | null>(null);
  const [notes, setNotes] = useState("");

  // Id-based cursor: survives restructures (add/remove/swap rebuild the sets
  // array) and only ever resolves FORWARD — a skipped exercise stays skipped.
  const current = resolveCursor(editor.sets, cursorId) ?? undefined;
  const currentBlock = current
    ? editor.blocks.find((b) => b.sets.some((s) => s.id === current.id))
    : undefined;
  const doneCount = editor.sets.filter((s) => s.completed).length;

  const shownKey = expandedKey ?? currentBlock?.key ?? null;

  const restSecondsLeft =
    restUntil !== null && now > 0 ? Math.ceil((restUntil - now) / 1000) : null;
  const resting = restSecondsLeft !== null && restSecondsLeft > 0;
  const ready = restSecondsLeft !== null && restSecondsLeft <= 0 && !finished;

  function logCurrent() {
    if (!current) return;
    const rx = prescriptions.find(
      (p) => p.exerciseId === current.exerciseId && p.modalityId === current.modalityId,
    );
    // advanceCursor looks strictly after `current`, so computing it before the
    // patch lands is safe. With nothing ahead the cursor parks on the logged
    // set itself, which self-recovers if more sets get appended later.
    const nextId = advanceCursor(editor.sets, current.id);
    editor.patchSet(current.id, { completed: true });
    setRestUntil(rx ? now + rx.restSeconds * 1000 : null);
    setCursorId(nextId ?? current.id);
    setExpandedKey(null); // follow the flow to the next block
  }

  // Removing the set/block the cursor sits on would strand it on a dead id
  // (parked); re-aim it at the next incomplete survivor ahead first.
  function removeSetKeepingCursor(setId: string) {
    if (current && setId === current.id) {
      setCursorId(advanceCursor(editor.sets, current.id));
    }
    editor.removeSet(setId);
  }

  function removeBlockKeepingCursor(block: Block) {
    if (current && block.sets.some((s) => s.id === current.id)) {
      const at = editor.sets.findIndex((s) => s.id === current.id);
      const survivor = editor.sets.find(
        (s, i) => i > at && !s.completed && !block.sets.some((b) => b.id === s.id),
      );
      setCursorId(survivor?.id ?? null);
    }
    editor.removeBlock(block);
  }

  function tapBlock(block: Block) {
    // Upcoming block: move the workout there. Finished block: just open it
    // for edits without touching the LOG cursor. (There is no explicit
    // "skip" — tapping the next exercise IS the skip; unchecked sets never
    // count toward anything.)
    const firstIncomplete = block.sets.find((s) => !s.completed);
    if (firstIncomplete) {
      setCursorId(firstIncomplete.id);
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
                  onClick={() => setPicker({ mode: "replace", block })}
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
                      removeBlockKeepingCursor(block);
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
                    onRemove={() => removeSetKeepingCursor(set.id)}
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

      <div className="mt-1">
        <Button size="sm" variant="ghost" onClick={() => setPicker({ mode: "add" })}>
          + Add exercise
        </Button>
      </div>

      {!current &&
        (editor.sets.some((s) => !s.completed) ? (
          <p className="mt-2 text-sm text-muted">
            Nothing ahead — tap a skipped exercise to log it, or finish below.
          </p>
        ) : (
          <p className="mt-2 text-sm text-success-text">All sets done — finish below.</p>
        ))}

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

      {picker && (
        <ExercisePicker
          variants={variants}
          onSelect={async (variant) => {
            const target = picker;
            setPicker(null);
            if (target.mode === "add") {
              const newSets = await editor.addExercise(variant);
              // A parked cursor (nothing ahead) jumps to the new work; an
              // in-flight cursor is unaffected by an append.
              if (!current && newSets.length > 0) setCursorId(newSets[0].id);
            } else {
              editor.swapExercise(target.block, variant);
            }
          }}
          onClose={() => setPicker(null)}
          emphasizePattern={
            picker.mode === "replace"
              ? exerciseById.get(picker.block.exerciseId)?.pattern
              : undefined
          }
        />
      )}
    </div>
  );
}
