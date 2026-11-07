"use client";

import { useState } from "react";
import { PlusIcon, SwapIcon, TrashIcon } from "@/components/icons";
import { ModalityChip } from "@/components/modality-chip";
import { OverflowMenu } from "@/components/overflow-menu";
import { SetRow } from "@/components/set-row";
import { Button } from "@/components/ui";
import type { SessionFlow, SetEditor } from "@/components/use-session-flow";
import { exerciseLookup, type ExerciseCatalog } from "@/lib/exercise-catalog";
import { mmss, shortDayLabel } from "@/lib/periods";
import type { VariantSessionSummary } from "@/lib/progress";
import { completedCount, rxLabel, upcomingFoldIndex } from "@/lib/session-labels";
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
 * block is expanded in place (big name, last time's sets, one-line set rows
 * with the active one open for LOG), the next block waits below and the rest
 * fold into one "Later: …" row. Tapping any collapsed row — including a
 * finished one — opens it for edits, so a wrong weight logged three
 * exercises ago is two taps away.
 */
export function SessionBlockList({
  editor,
  flow,
  prescriptions,
  catalog,
  history = {},
  dense = false,
  onReplace,
  onAdd,
}: {
  editor: SetEditor;
  flow: SessionFlow;
  prescriptions: readonly RoutineExercise[];
  catalog: ExerciseCatalog;
  /** Recent completed sessions per "exerciseId|modalityId" (this session
   *  excluded) — the expanded block's "Last" line. */
  history?: Record<string, VariantSessionSummary[]>;
  /** Tighter set rows for the group board's cards. */
  dense?: boolean;
  onReplace: (block: Block) => void;
  onAdd: () => void;
}) {
  const { current, currentBlock, shownKey, supersets } = flow;
  const { exerciseById, modalitiesByExercise } = exerciseLookup(catalog);
  const keyOf = (b: Block) => `${b.exerciseId}|${b.modalityId}`;
  // A tapped row stays open until the cursor moves (a LOG advances
  // it); then the new current set is the active one again.
  const [picked, setPicked] = useState<{ cursor: string | undefined; id: string } | null>(null);
  const activeSetId = picked && picked.cursor === current?.id ? picked.id : current?.id;
  const [showLater, setShowLater] = useState(false);

  const blocks = editor.blocks;
  const foldAt = showLater
    ? null
    : upcomingFoldIndex(
        blocks.map((b) => supersets.get(keyOf(b))),
        currentBlock ? blocks.indexOf(currentBlock) : -1,
        blocks.findIndex((b) => b.key === shownKey),
      );
  const shownBlocks = foldAt === null ? blocks : blocks.slice(0, foldAt);
  const laterBlocks = foldAt === null ? [] : blocks.slice(foldAt);

  return (
    <>
      {/* A size container — set rows lay out by the card's width. */}
      <ul className="@container space-y-1">
        {shownBlocks.map((block, index) => {
          const exercise = exerciseById.get(block.exerciseId);
          const blockBandRoles =
            modalitiesByExercise
              .get(block.exerciseId)
              ?.find((em) => em.modalityId === block.modalityId)?.bandRoles ?? [];
          const done = completedCount(block.sets);
          const blockDone = done === block.sets.length;
          const isCurrent = block === currentBlock;
          const isExpanded = block.key === shownKey;
          const rx = prescriptions.find(
            (p) => p.exerciseId === block.exerciseId && p.modalityId === block.modalityId,
          );
          // Adjacent blocks sharing a superset label render visually joined —
          // matching performOrder, which only interleaves adjacent runs.
          const label = supersets.get(keyOf(block));
          const prev = blocks[index - 1];
          const next = blocks[index + 1];
          const prevSame = label !== undefined && !!prev && supersets.get(keyOf(prev)) === label;
          const nextSame = label !== undefined && !!next && supersets.get(keyOf(next)) === label;
          const inSuperset = prevSame || nextSame;
          const supersetClass = inSuperset ? "border-l-2 border-l-accent/60" : "";
          // Zebra by block index (not CSS even:) so exercises stay separable
          // in dark mode; the current one also gets an accent ring.
          const stripe = `rounded-lg px-2 ${index % 2 === 1 ? "bg-surface-alt" : "bg-surface"} ${
            isCurrent ? "ring-1 ring-accent/40" : ""
          }`;
          const supersetTag = inSuperset && !prevSame && (
            <span className="rounded bg-accent-soft px-1.5 py-0.5 text-[11px] font-semibold text-accent-text">
              superset
            </span>
          );

          if (!isExpanded) {
            return (
              <li
                key={block.key}
                className={`${stripe} ${supersetClass}`}
              >
                <button
                  type="button"
                  onClick={() => flow.tapBlock(block)}
                  className={`flex min-h-11 w-full cursor-pointer items-center gap-2 rounded-md px-1 text-left text-sm hover:bg-current/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 ${
                    blockDone ? "text-muted" : ""
                  }`}
                >
                  <span
                    className={`font-mono text-xs ${blockDone ? "text-success-text" : "text-muted"}`}
                  >
                    {blockDone ? "✓" : `${done}/${block.sets.length} sets`}
                  </span>
                  <span className={`truncate ${blockDone ? "line-through decoration-current/40" : ""}`}>
                    {exercise?.name ?? block.exerciseId}
                  </span>
                  {supersetTag}
                </button>
              </li>
            );
          }

          return (
            <li
              key={block.key}
              className={`${stripe} py-2 ${supersetClass}`}
            >
              {/* Expanded header — tap collapses a manually opened block */}
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => !isCurrent && flow.collapseExpanded()}
                  className={`flex min-h-11 min-w-0 flex-1 flex-wrap items-center gap-2 rounded-md text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 ${
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
                <OverflowMenu
                  label={`${exercise?.name ?? "Exercise"} actions`}
                  items={[
                    {
                      label: "Swap exercise",
                      icon: <SwapIcon size={16} />,
                      onSelect: () => onReplace(block),
                    },
                    {
                      label: "Remove from session",
                      icon: <TrashIcon size={16} />,
                      danger: true,
                      onSelect: () => {
                        if (confirm(`Remove ${exercise?.name ?? "this exercise"} from the session?`)) {
                          flow.removeBlockKeepingCursor(block);
                        }
                      },
                    },
                  ]}
                />
              </div>
              {rx && <p className="mt-0.5 text-xs text-muted">{rxLabel(rx)}</p>}

              <LastTime sessions={history[keyOf(block)] ?? []} />

              {/* Editable sets */}
              <div className="mt-1.5">
                {block.sets.map((set) => (
                  <SetRow
                    key={set.id}
                    set={set}
                    dense={dense}
                    metricType={exercise?.metricType ?? "reps"}
                    bandRoles={blockBandRoles}
                    onChange={(changes) => editor.patchSet(set.id, changes)}
                    onLog={() => (set.id === current?.id ? flow.logCurrent() : flow.logSet(set.id))}
                    onRemove={() => flow.removeSetKeepingCursor(set.id)}
                    active={set.id === activeSetId}
                    onActivate={() => setPicked({ cursor: current?.id, id: set.id })}
                    logDisabled={editor.busy}
                  />
                ))}
                <Button size="sm" variant="ghost" onClick={() => editor.addSet(block)}>
                  <PlusIcon size={14} /> Add set
                </Button>
              </div>
            </li>
          );
        })}
        {laterBlocks.length > 0 && (
          <li
            className={`rounded-lg px-2 ${shownBlocks.length % 2 === 1 ? "bg-surface-alt" : "bg-surface"}`}
          >
            <button
              type="button"
              onClick={() => setShowLater(true)}
              aria-label={`Show ${laterBlocks.length} later exercises`}
              className="flex min-h-11 w-full cursor-pointer items-center gap-2 rounded-md px-1 text-left text-sm text-muted hover:bg-current/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
            >
              <span className="shrink-0 text-xs font-semibold uppercase tracking-wide">Later</span>
              <span className="min-w-0 truncate">
                {laterBlocks
                  .slice(0, 3)
                  .map((b) => exerciseById.get(b.exerciseId)?.name ?? b.exerciseId)
                  .join(" · ")}
              </span>
              {laterBlocks.length > 3 && (
                <span className="shrink-0 font-mono text-xs">+{laterBlocks.length - 3}</span>
              )}
            </button>
          </li>
        )}
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

/** "Last · Oct 16  135×10 135×10 135×8 F" — every working set from the most
 *  recent completed session of this variant; an inline "earlier" toggle at
 *  the end of the line reveals older ones. */
function LastTime({ sessions }: { sessions: VariantSessionSummary[] }) {
  const [showEarlier, setShowEarlier] = useState(false);
  if (sessions.length === 0) return null;
  const chips = (s: VariantSessionSummary) =>
    s.sets.map((set, i) => (
      <span key={i} className="rounded bg-current/10 px-1.5 py-0.5 font-mono text-xs">
        {set}
      </span>
    ));
  const [last, ...earlier] = sessions;
  return (
    <div className="mt-1.5 space-y-1">
      <div className="flex flex-wrap items-center gap-1">
        <span className="mr-0.5 text-xs text-muted">Last · {shortDayLabel(last.date)}</span>
        {chips(last)}
        {earlier.length > 0 && (
          <button
            type="button"
            onClick={() => setShowEarlier((v) => !v)}
            aria-expanded={showEarlier}
            className="inline-flex min-h-9 cursor-pointer items-center rounded-md px-1.5 text-xs text-muted hover:bg-current/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 pointer-coarse:min-h-11"
          >
            {showEarlier ? "less ▴" : "earlier ▾"}
          </button>
        )}
      </div>
      {showEarlier &&
        earlier.map((s) => (
          <div key={s.date} className="flex flex-wrap items-center gap-1">
            <span className="mr-0.5 text-xs text-muted">{shortDayLabel(s.date)}</span>
            {chips(s)}
          </div>
        ))}
    </div>
  );
}
