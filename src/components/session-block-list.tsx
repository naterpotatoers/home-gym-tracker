"use client";

import { useState } from "react";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { ExerciseInfoSheet } from "@/components/exercise-info-sheet";
import { InfoIcon, PlusIcon, SwapIcon, TrashIcon } from "@/components/icons";
import { ModalityChip } from "@/components/modality-chip";
import { OverflowMenu } from "@/components/overflow-menu";
import { ConditioningSetRow } from "@/components/conditioning-set-row";
import { SetRow } from "@/components/set-row";
import { Button, FOCUS_RING } from "@/components/ui";
import type { SessionFlow, SetEditor } from "@/components/use-session-flow";
import { exerciseLookup, variantKey, type ExerciseCatalog } from "@/lib/exercise-catalog";
import { variantOf } from "@/lib/modality";
import { mmss, shortDayLabel } from "@/lib/periods";
import type { StallHint } from "@/lib/progression";
import type { VariantSessionSummary } from "@/lib/progress";
import {
  blockPrescription,
  blockRxLine,
  blockStall,
  blockSupersetLabel,
  completedCount,
  stallCallout,
  supersetPosition,
  upcomingFoldIndex,
} from "@/lib/session-labels";
import type { Block } from "@/lib/set-blocks";
import type { BandRole, Exercise, RoutineExercise, SetLog } from "@/lib/types";
import { isBikeWarmupBlock } from "@/lib/warmup";

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
  stalls = {},
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
  /** Lifts with no progress in 3+ weeks, per "exerciseId|modalityId". */
  stalls?: Record<string, StallHint>;
  /** Tighter set rows for the group board's cards. */
  dense?: boolean;
  onReplace: (block: Block) => void;
  onAdd: () => void;
}) {
  const { current, currentBlock, shownKey, supersets } = flow;
  const { exerciseById } = exerciseLookup(catalog);
  const keyOf = (b: Block) => variantKey(b.exerciseId, b.modalityId);
  // A tapped row stays open until the cursor moves (a LOG advances
  // it); then the new current set is the active one again.
  const [picked, setPicked] = useState<{ cursor: string | undefined; id: string } | null>(null);
  const activeSetId = picked && picked.cursor === current?.id ? picked.id : current?.id;
  const [showLater, setShowLater] = useState(false);
  const [explaining, setExplaining] = useState<{ block: Block; rowNote: string } | null>(null);

  const blocks = editor.blocks;
  const supersetLabels = blocks.map((b) => blockSupersetLabel(supersets, b));
  const foldAt = showLater
    ? null
    : upcomingFoldIndex(
        supersetLabels,
        currentBlock ? blocks.indexOf(currentBlock) : -1,
        blocks.findIndex((b) => b.key === shownKey),
      );
  const shownBlocks = foldAt === null ? blocks : blocks.slice(0, foldAt);
  const laterBlocks = foldAt === null ? [] : blocks.slice(foldAt);

  return (
    <>
      {/* A size container — set rows lay out by the card's width. */}
      <ul className="@container space-y-1.5">
        {shownBlocks.map((block, index) => (
          <SessionBlock
            key={block.key}
            block={block}
            exercise={exerciseById.get(block.exerciseId)}
            bandRoles={variantOf(catalog, block)?.bandRoles ?? []}
            rx={blockPrescription(prescriptions, block)}
            stall={blockStall(block, stalls)}
            lastSessions={history[keyOf(block)] ?? []}
            superset={supersetPosition(supersetLabels, index)}
            isCurrent={block === currentBlock}
            isExpanded={block.key === shownKey}
            activeSetId={activeSetId}
            dense={dense}
            editor={editor}
            flow={flow}
            onPickSet={(id) => setPicked({ cursor: current?.id, id })}
            onExplain={(rowNote) => setExplaining({ block, rowNote })}
            onReplace={() => onReplace(block)}
          />
        ))}
        {laterBlocks.length > 0 && (
          <li className="rounded-lg border border-border bg-surface-alt px-2">
            <button
              type="button"
              onClick={() => setShowLater(true)}
              aria-label={`Show ${laterBlocks.length} later exercises`}
              className={`flex min-h-11 w-full cursor-pointer items-center gap-2 rounded-md px-1 text-left text-sm text-muted hover:bg-current/5 ${FOCUS_RING}`}
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

      {explaining && (
        <ExerciseInfoSheet
          catalog={catalog}
          exerciseId={explaining.block.exerciseId}
          modalityId={explaining.block.modalityId}
          rowNote={explaining.rowNote}
          onClose={() => setExplaining(null)}
        />
      )}

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

/**
 * One exercise in the list. Collapsed: a checked/progress row that opens on
 * tap. Expanded: the name (big when it's the current block), its tags, the
 * ⋯ menu, the rx line, last time's sets, a stall callout, and the editable
 * set rows. The bike warm-up is labelled, gets its own rx line and no "Last"
 * line (that history is the person's finisher pieces).
 */
function SessionBlock({
  block,
  exercise,
  bandRoles,
  rx,
  stall,
  lastSessions,
  superset,
  isCurrent,
  isExpanded,
  activeSetId,
  dense,
  editor,
  flow,
  onPickSet,
  onExplain,
  onReplace,
}: {
  block: Block;
  exercise: Exercise | undefined;
  bandRoles: readonly BandRole[];
  rx: RoutineExercise | undefined;
  stall: StallHint | undefined;
  lastSessions: VariantSessionSummary[];
  superset: { inSuperset: boolean; starts: boolean };
  isCurrent: boolean;
  isExpanded: boolean;
  activeSetId: string | undefined;
  dense: boolean;
  editor: SetEditor;
  flow: SessionFlow;
  onPickSet: (setId: string) => void;
  onExplain: (rowNote: string) => void;
  onReplace: () => void;
}) {
  const name = exercise?.name ?? block.exerciseId;
  const isBike = exercise?.pattern === "conditioning";
  const isWarmup = isBikeWarmupBlock(block);
  const [confirmingRemove, setConfirmingRemove] = useState(false);
  const done = completedCount(block.sets);
  const blockDone = done === block.sets.length;
  const rxLine = blockRxLine(rx, block, isBike);
  // Adjacent superset members render visually joined.
  const supersetClass = superset.inSuperset ? "border-l-2 border-l-accent/60" : "";
  const tags = (
    <>
      {isWarmup && (
        <span className="rounded bg-current/10 px-1.5 py-0.5 text-[11px] font-semibold">warm-up</span>
      )}
      {stall && (
        <span className="rounded bg-warning/15 px-1.5 py-0.5 text-[11px] font-semibold text-warning-text">
          stalled
        </span>
      )}
      {superset.starts && (
        <span className="rounded bg-accent-soft px-1.5 py-0.5 text-[11px] font-semibold text-accent-text">
          superset
        </span>
      )}
    </>
  );

  // Collapsed exercises are lighter outlined cards so each one reads on its
  // own (zebra stripes blurred together in dark mode); the open one stays on
  // the darker card surface, and the current one also gets an accent ring.
  if (!isExpanded) {
    return (
      <li className={`rounded-lg border border-border bg-surface-alt px-2 ${supersetClass}`}>
        <button
          type="button"
          onClick={() => flow.tapBlock(block)}
          className={`flex min-h-11 w-full cursor-pointer items-center gap-2 rounded-md px-1 text-left text-sm hover:bg-current/5 ${FOCUS_RING} ${
            blockDone ? "text-muted" : ""
          }`}
        >
          <span className={`font-mono text-xs ${blockDone ? "text-success-text" : "text-muted"}`}>
            {blockDone ? "✓" : `${done}/${block.sets.length} sets`}
          </span>
          <span className={`truncate ${blockDone ? "line-through decoration-current/40" : ""}`}>{name}</span>
          {tags}
        </button>
      </li>
    );
  }

  const current = flow.current;
  return (
    <li
      className={`rounded-lg border border-transparent bg-surface px-2 py-2 ${
        isCurrent ? "ring-1 ring-accent/40" : ""
      } ${supersetClass}`}
    >
      {/* Expanded header — tap collapses a manually opened block */}
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => !isCurrent && flow.collapseExpanded()}
          className={`flex min-h-11 min-w-0 flex-1 flex-wrap items-center gap-2 rounded-md text-left ${FOCUS_RING} ${
            isCurrent ? "cursor-default" : "cursor-pointer"
          }`}
        >
          <h3 className={isCurrent ? "text-xl font-bold tracking-tight" : "text-base font-semibold"}>{name}</h3>
          <ModalityChip modalityId={block.modalityId} />
          {tags}
          {blockDone && <span className="font-mono text-xs text-success-text">✓ done</span>}
          {!isCurrent && <span className="text-xs text-muted">▴</span>}
        </button>
        {isCurrent && !blockDone && (
          // Visible, one tap: the warm-up just goes; a lift stays listed as
          // skipped (tap it to come back).
          <Button
            variant="ghost"
            onClick={() => flow.skipBlock(block)}
            aria-label={isWarmup ? "Skip warm-up" : `Skip ${name}`}
            className="shrink-0 px-3"
          >
            {isWarmup ? "Skip warm-up" : "Skip"}
          </Button>
        )}
        <OverflowMenu
          label={`${exercise?.name ?? "Exercise"} actions`}
          items={[
            {
              label: "Explain exercise",
              icon: <InfoIcon size={16} />,
              onSelect: () => onExplain(isWarmup ? "" : (rx?.notes ?? "")),
            },
            { label: "Swap exercise", icon: <SwapIcon size={16} />, onSelect: onReplace },
            {
              label: "Remove from session",
              icon: <TrashIcon size={16} />,
              danger: true,
              onSelect: () => setConfirmingRemove(true),
            },
          ]}
        />
      </div>
      {confirmingRemove && (
        <ConfirmDialog
          title={`Remove ${name}${isWarmup ? " warm-up" : ""}?`}
          body={
            done > 0
              ? `Its ${done} logged ${done === 1 ? "set is" : "sets are"} deleted too.`
              : "It comes out of this session only — the routine is unchanged."
          }
          confirmLabel="Remove"
          onConfirm={() => flow.removeBlockKeepingCursor(block)}
          onClose={() => setConfirmingRemove(false)}
        />
      )}
      {rxLine && <p className="mt-0.5 text-xs text-muted">{rxLine}</p>}

      {!isWarmup && <LastTime sessions={lastSessions} />}

      {stall && (
        <p className="mt-1.5 border-l-2 border-warning pl-2 text-xs">
          <span className="font-semibold text-warning-text">Stalled · </span>
          {stallCallout(stall, block.modalityId)}
        </p>
      )}

      {/* Editable sets */}
      <div className="mt-1.5">
        {block.sets.map((set) => {
          const rowProps = {
            set,
            dense,
            onChange: (changes: Partial<SetLog>) => editor.patchSet(set.id, changes),
            onLog: ({ relog }: { relog: boolean }) =>
              relog
                ? flow.logSet(set.id, { rest: false })
                : set.id === current?.id
                  ? flow.logCurrent()
                  : flow.logSet(set.id),
            onRemove: () => flow.removeSetKeepingCursor(set.id),
            active: set.id === activeSetId,
            onActivate: () => onPickSet(set.id),
            logDisabled: editor.busy,
          };
          return isBike ? (
            <ConditioningSetRow key={set.id} {...rowProps} />
          ) : (
            <SetRow
              key={set.id}
              {...rowProps}
              metricType={exercise?.metricType ?? "reps"}
              bandRoles={bandRoles}
            />
          );
        })}
        <Button size="sm" variant="ghost" onClick={() => editor.addSet(block)}>
          <PlusIcon size={14} /> {isBike ? "Add piece" : "Add set"}
        </Button>
      </div>
    </li>
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
            className={`inline-flex min-h-9 cursor-pointer items-center rounded-md px-1.5 text-xs text-muted hover:bg-current/5 ${FOCUS_RING} pointer-coarse:min-h-11`}
          >
            {showEarlier ? "less ▴" : "earlier ▾"}
          </button>
        )}
      </div>
      {showEarlier &&
        earlier.map((s) => (
          <div key={s.sessionId} className="flex flex-wrap items-center gap-1">
            <span className="mr-0.5 text-xs text-muted">{shortDayLabel(s.date)}</span>
            {chips(s)}
          </div>
        ))}
    </div>
  );
}
