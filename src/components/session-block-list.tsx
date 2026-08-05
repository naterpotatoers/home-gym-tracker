"use client";

import { PlusIcon, SwapIcon, TrashIcon } from "@/components/icons";
import { ModalityChip } from "@/components/modality-chip";
import { SetRow } from "@/components/set-row";
import { Button, IconButton } from "@/components/ui";
import type { SessionFlow, SetEditor } from "@/components/use-session-flow";
import { exerciseById } from "@/lib/data/exercises";
import { mmss } from "@/lib/periods";
import { describeTarget, rxLabel } from "@/lib/session-labels";
import type { Block } from "@/lib/set-blocks";
import type { RoutineExercise } from "@/lib/types";

/** The "rest m:ss" / "ready" status pair — same chips on the solo runner's
 *  header and each group-board card. */
export function RestReadyChips({ flow }: { flow: SessionFlow }) {
  return (
    <>
      {flow.resting && flow.restSecondsLeft !== null && (
        <span className="font-mono text-xs font-semibold text-warning-text">
          rest {mmss(flow.restSecondsLeft)}
        </span>
      )}
      {flow.ready && (
        <span className="text-xs font-semibold text-success-text">ready</span>
      )}
    </>
  );
}

/**
 * The session as a list you work down — shared by the solo runner and each
 * group-board card: finished blocks collapse into checked rows, the current
 * block is expanded in place (big name, LOG hero, editable sets), upcoming
 * blocks wait below. Tapping any collapsed row — including a finished one —
 * opens it for edits, so a wrong weight logged three exercises ago is two
 * taps away.
 */
export function SessionBlockList({
  editor,
  flow,
  prescriptions,
  dense = false,
  onReplace,
  onAdd,
}: {
  editor: SetEditor;
  flow: SessionFlow;
  prescriptions: readonly RoutineExercise[];
  /** Tighter set rows for the group board's cards. */
  dense?: boolean;
  onReplace: (block: Block) => void;
  onAdd: () => void;
}) {
  const { current, currentBlock, shownKey, supersets } = flow;
  const keyOf = (b: Block) => `${b.exerciseId}|${b.modalityId}`;

  return (
    <>
      <ul>
        {editor.blocks.map((block, index) => {
          const exercise = exerciseById.get(block.exerciseId);
          const done = block.sets.filter((s) => s.completed).length;
          const blockDone = done === block.sets.length;
          const isCurrent = block === currentBlock;
          const isExpanded = block.key === shownKey;
          const rx = prescriptions.find(
            (p) => p.exerciseId === block.exerciseId && p.modalityId === block.modalityId,
          );
          // Adjacent blocks sharing a superset label render visually joined —
          // matching performOrder, which only interleaves adjacent runs.
          const label = supersets.get(keyOf(block));
          const prev = editor.blocks[index - 1];
          const next = editor.blocks[index + 1];
          const prevSame = label !== undefined && !!prev && supersets.get(keyOf(prev)) === label;
          const nextSame = label !== undefined && !!next && supersets.get(keyOf(next)) === label;
          const inSuperset = prevSame || nextSame;
          const supersetClass = inSuperset ? "border-l-2 border-l-accent/60 pl-1.5" : "";
          const supersetTag = inSuperset && !prevSame && (
            <span className="rounded bg-accent-soft px-1.5 py-0.5 text-[10px] font-semibold text-accent-text">
              superset
            </span>
          );

          if (!isExpanded) {
            return (
              <li
                key={block.key}
                className={`border-t border-border first:border-t-0 ${supersetClass}`}
              >
                <button
                  type="button"
                  onClick={() => flow.tapBlock(block)}
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
                  {supersetTag}
                  <span className="ml-auto text-xs text-muted">
                    {blockDone ? "tap to adjust" : ""}
                  </span>
                </button>
              </li>
            );
          }

          return (
            <li
              key={block.key}
              className={`border-t border-border py-2 first:border-t-0 ${supersetClass}`}
            >
              {/* Expanded header — tap collapses a manually opened block */}
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => !isCurrent && flow.collapseExpanded()}
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
                  {supersetTag}
                  {blockDone && (
                    <span className="font-mono text-xs text-success-text">✓ done</span>
                  )}
                  {!isCurrent && <span className="text-xs text-muted">▴</span>}
                </button>
                <IconButton
                  variant="ghost"
                  size="sm"
                  onClick={() => onReplace(block)}
                  aria-label="Swap exercise"
                  title="Swap exercise"
                >
                  <SwapIcon />
                </IconButton>
                <IconButton
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    if (confirm(`Remove ${exercise?.name ?? "this exercise"} from the session?`)) {
                      flow.removeBlockKeepingCursor(block);
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
                    onClick={flow.logCurrent}
                    disabled={editor.busy}
                    className="min-h-11 cursor-pointer rounded-md border border-accent-warm/60 px-4 text-sm font-bold tracking-wide text-accent-warm-text hover:bg-accent-warm/10 disabled:opacity-50"
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
                    dense={dense}
                    metricType={exercise?.metricType ?? "reps"}
                    onChange={(changes) => editor.patchSet(set.id, changes)}
                    onRemove={() => flow.removeSetKeepingCursor(set.id)}
                  />
                ))}
                <div className="mt-1 flex justify-end">
                  <Button size="sm" onClick={() => editor.addSet(block)}>
                    <PlusIcon size={14} /> Add set
                  </Button>
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      <div className="mt-1">
        <Button size="sm" variant="ghost" onClick={onAdd}>
          <PlusIcon size={14} /> Add exercise
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
    </>
  );
}
