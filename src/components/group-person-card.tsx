"use client";

import Link from "next/link";
import { useState } from "react";
import { EffortPicker } from "@/components/effort-picker";
import { ExercisePicker } from "@/components/exercise-picker";
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
      <div className="flex flex-wrap items-baseline gap-2 rounded-lg border border-current/10 bg-current/5 px-4 py-3 text-sm">
        <span className="font-semibold">{clientName}</span>
        <span className="opacity-60">done · {doneCount} sets</span>
        {rpe !== null && (
          <span className="rounded bg-current/10 px-1.5 py-0.5 text-xs">RPE {rpe}</span>
        )}
        {condition && (
          <span className="rounded bg-current/10 px-1.5 py-0.5 text-xs">felt {condition}</span>
        )}
        <Link
          href={`/workout/session/${session.id}`}
          className="ml-auto text-xs underline underline-offset-2 opacity-60"
        >
          recap
        </Link>
      </div>
    );
  }

  return (
    <div
      className={`rounded-lg border p-3 transition-opacity ${
        ready ? "border-current/40 ring-1 ring-current/40" : "border-current/10"
      } ${resting ? "opacity-70" : ""}`}
    >
      {/* Header */}
      <div className="flex flex-wrap items-baseline gap-2">
        <span className="font-semibold">{clientName}</span>
        {currentExercise && (
          <span className="text-sm opacity-80">{currentExercise.name}</span>
        )}
        {current && (
          <span className="rounded bg-current/10 px-1.5 py-0.5 text-xs">
            {modalityById.get(current.modalityId)?.name ?? current.modalityId}
          </span>
        )}
        <span className="ml-auto font-mono text-xs opacity-60">
          {doneCount}/{editor.sets.length}
        </span>
        {resting && (
          <span className="font-mono text-xs opacity-80">
            rest {Math.floor(restSecondsLeft / 60)}:{String(restSecondsLeft % 60).padStart(2, "0")}
          </span>
        )}
        {ready && <span className="text-xs font-semibold">ready</span>}
      </div>
      {rx && (
        <p className="mt-0.5 text-xs opacity-50">
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
            className="flex-1 rounded border border-current/20 px-3 py-2 text-left hover:bg-current/5"
          >
            <span className="text-xs opacity-50">Set {current.setNumber} · </span>
            <span className="font-mono text-sm font-semibold">
              {describeTarget(current)}
            </span>
            <span className="ml-2 text-xs opacity-40">{expanded ? "▲" : "adjust ▾"}</span>
          </button>
          <button
            type="button"
            onClick={logCurrent}
            disabled={editor.busy}
            className="min-h-12 rounded border border-current/30 bg-current/15 px-6 text-sm font-bold tracking-wide hover:bg-current/25 disabled:opacity-50"
          >
            LOG
          </button>
        </div>
      ) : (
        <p className="mt-2 text-sm opacity-70">All sets done — finish below.</p>
      )}

      {/* Footer row: up next + blocks + finish */}
      <div className="mt-2 flex flex-wrap items-baseline gap-3 text-xs">
        {upNext && upNext.exerciseId !== current?.exerciseId && (
          <span className="opacity-50">
            next: {exerciseById.get(upNext.exerciseId)?.name}
          </span>
        )}
        <button
          type="button"
          onClick={() => setShowBlocks((v) => !v)}
          className="underline underline-offset-2 opacity-60 hover:opacity-100"
        >
          Blocks ▾
        </button>
        {current && (
          <button
            type="button"
            onClick={skipCurrent}
            className="opacity-50 hover:opacity-100"
          >
            Skip set
          </button>
        )}
        <button
          type="button"
          onClick={() => setFinishing((v) => !v)}
          className="ml-auto underline underline-offset-2 opacity-60 hover:opacity-100"
        >
          Finish…
        </button>
        {editor.error && <span className="w-full font-semibold">{editor.error}</span>}
      </div>

      {/* Blocks sheet: jump anywhere (staggering) */}
      {showBlocks && (
        <ul className="mt-2 space-y-1 rounded border border-current/10 p-2 text-sm">
          {editor.blocks.map((block) => {
            const done = block.sets.filter((s) => s.completed).length;
            const isCurrent = block === currentBlock;
            return (
              <li key={block.key}>
                <button
                  type="button"
                  onClick={() => jumpToBlock(block)}
                  className={`flex w-full items-baseline gap-2 rounded px-2 py-1 text-left hover:bg-current/10 ${
                    isCurrent ? "bg-current/5 font-semibold" : ""
                  }`}
                >
                  <span>{exerciseById.get(block.exerciseId)?.name}</span>
                  <span className="text-xs opacity-50">
                    {modalityById.get(block.modalityId)?.name}
                  </span>
                  <span className="ml-auto font-mono text-xs opacity-60">
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
        <div className="mt-2 rounded border border-current/10 p-2">
          <div className="divide-y divide-current/5">
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
            <button
              type="button"
              onClick={() => editor.addSet(currentBlock)}
              className="rounded border border-current/20 px-2 py-1 text-xs hover:bg-current/10"
            >
              + Add set
            </button>
            <button
              type="button"
              onClick={() => setSwapBlock(currentBlock)}
              className="rounded border border-current/20 px-2 py-1 text-xs hover:bg-current/10"
            >
              Replace exercise
            </button>
          </div>
        </div>
      )}

      {/* Inline finish panel */}
      {finishing && (
        <div className="mt-3 space-y-3 border-t border-current/10 pt-3">
          <EffortPicker
            rpe={rpe}
            condition={condition}
            onChange={(patch) => {
              if (patch.rpe !== undefined) setRpe(patch.rpe);
              if (patch.condition !== undefined) setCondition(patch.condition);
            }}
          />
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Notes"
              className="min-w-48 flex-1 rounded border border-current/20 bg-transparent px-2 py-1.5 text-sm outline-none"
            />
            <button
              type="button"
              onClick={handleFinish}
              disabled={finishBusy}
              className="rounded border border-current/20 bg-current/10 px-4 py-1.5 text-sm font-semibold hover:bg-current/20 disabled:opacity-50"
            >
              {finishBusy ? "Saving…" : `Finish ${clientName}`}
            </button>
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
