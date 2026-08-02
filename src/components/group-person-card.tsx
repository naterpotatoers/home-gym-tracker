"use client";

import Link from "next/link";
import { useState } from "react";
import { EffortPicker } from "@/components/effort-picker";
import { ExercisePicker } from "@/components/exercise-picker";
import { Button, Input } from "@/components/ui";
import type { BoardPerson } from "@/components/group-board";
import { SetRow } from "@/components/set-row";
import { useSetEditor } from "@/components/use-set-editor";
import { finishSession } from "@/lib/actions/workout";
import { exerciseById } from "@/lib/data/exercises";
import { modalityById } from "@/lib/data/modalities";
import type { Variant } from "@/lib/queries";
import type { Block } from "@/lib/set-blocks";
import type { SessionCondition, SetLog } from "@/lib/types";

function bandLabel(set: SetLog): string {
  return set.bandId?.replace(/^(band|hip_band)_/, "").replace(/_/g, "/") ?? "band";
}

/** Short prefilled-target label for the one-tap hero row. */
function describeTarget(set: SetLog): string {
  if (set.durationSeconds !== null) return `${set.durationSeconds}s`;
  const reps = set.reps !== null ? ` × ${set.reps}` : "";
  switch (set.modalityId) {
    case "barbell":
    case "machine":
      return `${set.weightLbs ?? "—"} lb${reps}`;
    case "dumbbell":
      return set.distanceFeet !== null
        ? `${set.weightLbs ?? "—"} lb × ${set.distanceFeet} ft`
        : `${set.weightLbs ?? "—"} lb ea${reps}`;
    case "bodyweight":
      return `BW${set.addedWeightLbs ? `+${set.addedWeightLbs}` : ""}${reps}`;
    case "band":
      return `${bandLabel(set)} band${reps}`;
  }
}

/** First index at or after `from` that isn't completed, wrapping once. */
function nextIncomplete(sets: readonly SetLog[], from: number): number {
  for (let i = from; i < sets.length; i++) if (!sets[i].completed) return i;
  for (let i = 0; i < from; i++) if (!sets[i].completed) return i;
  return -1;
}

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
  const { session, initialSets, prescriptions, clientName, routineName } = person;
  const editor = useSetEditor(session, initialSets);
  const [cursor, setCursor] = useState(() => {
    const first = initialSets.findIndex((s) => !s.completed);
    return first === -1 ? -1 : first;
  });
  const [expanded, setExpanded] = useState(false);
  const [showBlocks, setShowBlocks] = useState(false);
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
  const currentExercise = current ? exerciseById.get(current.exerciseId) : undefined;
  const rx = current
    ? prescriptions.find(
        (p) => p.exerciseId === current.exerciseId && p.modalityId === current.modalityId,
      )
    : undefined;
  const doneCount = editor.sets.filter((s) => s.completed).length;

  const restSecondsLeft =
    restUntil !== null && now > 0 ? Math.ceil((restUntil - now) / 1000) : null;
  const resting = restSecondsLeft !== null && restSecondsLeft > 0;
  const ready = restSecondsLeft !== null && restSecondsLeft <= 0 && !finished;

  // The set after the current one, for the "next:" preview.
  const upNextIndex = current
    ? nextIncomplete(
        editor.sets.map((s, i) => (i === effectiveCursor ? { ...s, completed: true } : s)),
        effectiveCursor + 1,
      )
    : -1;
  const upNext = upNextIndex >= 0 ? editor.sets[upNextIndex] : undefined;

  function logCurrent() {
    if (!current) return;
    editor.patchSet(current.id, { completed: true });
    setRestUntil(rx ? Date.now() + rx.restSeconds * 1000 : null);
    setCursor(upNextIndex);
  }

  function skipCurrent() {
    if (!current) return;
    const next = nextIncomplete(editor.sets, effectiveCursor + 1);
    setCursor(next === effectiveCursor ? -1 : next);
  }

  function jumpToBlock(block: Block) {
    const target = block.sets.find((s) => !s.completed) ?? block.sets[0];
    const index = editor.sets.findIndex((s) => s.id === target.id);
    if (index >= 0) setCursor(index);
    setShowBlocks(false);
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
      <div className="flex flex-wrap items-baseline gap-2 rounded-xl border border-success/40 bg-success/10 px-4 py-3 text-sm">
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
      className={`rounded-xl border bg-surface p-3 transition-opacity ${
        ready ? "border-accent ring-1 ring-accent" : "border-border"
      } ${resting ? "opacity-70" : ""}`}
    >
      {/* Header */}
      <div className="flex flex-wrap items-baseline gap-2">
        <span className="font-semibold">{clientName}</span>
        {currentExercise && (
          <span className="text-sm">{currentExercise.name}</span>
        )}
        {current && (
          <span className="rounded bg-current/10 px-1.5 py-0.5 text-xs">
            {modalityById.get(current.modalityId)?.name ?? current.modalityId}
          </span>
        )}
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
      {rx && (
        <p className="mt-0.5 text-xs text-muted">
          {routineName} ·{" "}
          {rx.durationSeconds !== null
            ? `${rx.sets}×${rx.durationSeconds}s`
            : `${rx.sets}×${rx.repMin ?? "?"}–${rx.repMax ?? "?"}`}
          {rx.targetRir !== null && ` @ RIR ${rx.targetRir}`} · rest {rx.restSeconds}s
        </p>
      )}

      {/* Hero: current set + one-tap LOG */}
      {current ? (
        <div className="mt-2 flex items-stretch gap-2">
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="min-h-12 flex-1 rounded-md border border-border-strong bg-surface-input px-3 py-2 text-left hover:border-accent/50"
          >
            <span className="text-xs text-muted">Set {current.setNumber} · </span>
            <span className="font-mono text-sm font-semibold">
              {describeTarget(current)}
            </span>
            <span className="ml-2 text-xs text-muted">{expanded ? "▲" : "adjust ▾"}</span>
          </button>
          <button
            type="button"
            onClick={logCurrent}
            disabled={editor.busy}
            className="min-h-12 rounded-md bg-accent-strong px-6 text-sm font-bold tracking-wide text-accent-fg hover:opacity-90 disabled:opacity-50"
          >
            LOG
          </button>
        </div>
      ) : (
        <p className="mt-2 text-sm text-success-text">All sets done — finish below.</p>
      )}

      {/* Footer row: up next + blocks + finish */}
      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
        {upNext && upNext.exerciseId !== current?.exerciseId && (
          <span className="self-center text-muted">
            next: {exerciseById.get(upNext.exerciseId)?.name}
          </span>
        )}
        <Button variant="ghost" size="sm" onClick={() => setShowBlocks((v) => !v)}>
          Blocks ▾
        </Button>
        {current && (
          <Button variant="ghost" size="sm" onClick={skipCurrent}>
            Skip set
          </Button>
        )}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setFinishing((v) => !v)}
          className="ml-auto"
        >
          Finish…
        </Button>
        {editor.error && (
          <span className="w-full font-semibold text-danger-text">{editor.error}</span>
        )}
      </div>

      {/* Blocks sheet: jump anywhere (staggering) */}
      {showBlocks && (
        <ul className="mt-2 space-y-1 rounded-md border border-border p-2 text-sm">
          {editor.blocks.map((block) => {
            const done = block.sets.filter((s) => s.completed).length;
            const isCurrent = block === currentBlock;
            return (
              <li key={block.key}>
                <button
                  type="button"
                  onClick={() => jumpToBlock(block)}
                  className={`flex min-h-11 w-full items-center gap-2 rounded-md px-2 py-1 text-left hover:bg-current/5 ${
                    isCurrent ? "bg-accent-soft font-semibold text-accent-text" : ""
                  }`}
                >
                  <span>{exerciseById.get(block.exerciseId)?.name}</span>
                  <span className="text-xs text-muted">
                    {modalityById.get(block.modalityId)?.name}
                  </span>
                  <span className="ml-auto font-mono text-xs text-muted">
                    {done}/{block.sets.length}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {/* Expanded: full editing of the current block */}
      {expanded && currentBlock && (
        <div className="mt-2 rounded-md border border-border p-2">
          <div className="divide-y divide-border">
            {currentBlock.sets.map((set) => (
              <SetRow
                key={set.id}
                set={set}
                metricType={
                  exerciseById.get(currentBlock.exerciseId)?.metricType ?? "reps"
                }
                onChange={(changes) => editor.patchSet(set.id, changes)}
                onRemove={() => editor.removeSet(set.id)}
              />
            ))}
          </div>
          <div className="mt-2 flex gap-2">
            <Button size="sm" onClick={() => editor.addSet(currentBlock)}>
              + Add set
            </Button>
            <Button size="sm" onClick={() => setSwapBlock(currentBlock)}>
              Replace exercise
            </Button>
          </div>
        </div>
      )}

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
