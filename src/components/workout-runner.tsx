"use client";

import Link from "next/link";
import { unstable_rethrow } from "next/navigation";
import { useState } from "react";
import { ExercisePicker } from "@/components/exercise-picker";
import { ArrowLeftIcon, CheckIcon, TrashIcon } from "@/components/icons";
import { FinishPanel, type FinishPayload } from "@/components/finish-panel";
import { RestReadyChips, SessionBlockList } from "@/components/session-block-list";
import { Button, chipClass, ErrorText, NumberInput } from "@/components/ui";
import { useSessionClock } from "@/components/use-session-clock";
import { useSessionFlow } from "@/components/use-session-flow";
import { useSetEditor } from "@/components/use-set-editor";
import { useWakeLock } from "@/components/use-wake-lock";
import { discardSession, finishSession } from "@/lib/actions/workout";
import { exerciseLookup, type ExerciseCatalog } from "@/lib/exercise-catalog";
import type { VariantSessionSummary } from "@/lib/progress";
import type { Variant } from "@/lib/queries";
import type { RoutineExercise, Session, SetLog } from "@/lib/types";
import { errorMessage } from "@/lib/format";
import { completedCount } from "@/lib/session-labels";

import type { Block } from "@/lib/set-blocks";

// The Block itself, not its index — a sync landing while the picker is open
// rebuilds `blocks`, and a stale index would swap the wrong exercise.
type PickerTarget = { mode: "add" } | { mode: "replace"; block: Block };

/** For actions that redirect on success: when `e` is Next's redirect signal,
 *  run `onSuccess` and rethrow it; otherwise return so the caller reports. */
function rethrowAfter(e: unknown, onSuccess: () => void) {
  try {
    unstable_rethrow(e);
  } catch (signal) {
    onSuccess();
    throw signal;
  }
}

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
  routineName,
  recentKeys,
  history,
}: {
  session: Session;
  initialSets: SetLog[];
  prescriptions: RoutineExercise[];
  variants: Variant[];
  catalog: ExerciseCatalog;
  clientName: string;
  routineName: string;
  recentKeys?: string[];
  /** Last sessions per variant, for each block's "Last" line. */
  history?: Record<string, VariantSessionSummary[]>;
}) {
  const editor = useSetEditor(session, initialSets);
  const clock = useSessionClock(session.id);
  const flow = useSessionFlow(editor, prescriptions, clock.now);
  useWakeLock();
  const [picker, setPicker] = useState<PickerTarget | null>(null);
  /** "End early" opened the check-in before every set was logged. */
  const [endingEarly, setEndingEarly] = useState(false);
  const [finishBusy, setFinishBusy] = useState(false);
  /** Manual minutes correction; undefined = trust the clock, null = the
   *  field was cleared (saves no duration). */
  const [durationOverride, setDurationOverride] = useState<number | null | undefined>(
    undefined,
  );

  const doneCount = completedCount(editor.sets);
  // The check-in appears on its own once nothing is left to log.
  const finishing = endingEarly || !flow.current;
  const durationMinutes =
    durationOverride === undefined ? clock.elapsedMinutes : durationOverride;

  async function handleFinish(payload: FinishPayload) {
    setFinishBusy(true);
    editor.setError(null);
    try {
      await editor.flush();
      await finishSession(session.id, {
        durationMinutes: durationMinutes ? Math.round(durationMinutes) : null,
        ...payload,
      });
    } catch (e) {
      // finishSession redirects on success: clear the stored clock start only
      // then (a failed finish keeps the elapsed time), and let the redirect
      // through instead of showing it as an error.
      rethrowAfter(e, clock.clear);
      editor.setError(errorMessage(e, "Save failed."));
      setFinishBusy(false);
    }
  }

  async function handleDiscard() {
    if (!confirm("Discard this session? All logged sets are deleted.")) return;
    try {
      await discardSession(session.id);
    } catch (e) {
      rethrowAfter(e, clock.clear);
      editor.setError(errorMessage(e, "Discard failed."));
    }
  }

  return (
    // Focus mode: hides the app nav while the runner is up (globals.css).
    <div data-focus-mode>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <Link href="/" className={chipClass(false, "min-h-9 pointer-coarse:min-h-11 px-2.5 text-xs")}>
          <ArrowLeftIcon size={14} /> Exit
        </Link>
        <h1 className="text-2xl font-bold tracking-tight">
          {clientName} <span className="font-normal text-muted">· {routineName}</span>
        </h1>
        <span className="font-mono text-xs text-muted">
          {doneCount}/{editor.sets.length} sets · {clock.elapsedMinutes} min
        </span>
        <RestReadyChips flow={flow} />
        {/* Destructive and rare — kept well away from Finish. */}
        <Button variant="ghost" size="sm" onClick={handleDiscard} className="ml-auto text-danger-text">
          <TrashIcon size={14} /> Discard
        </Button>
        {editor.error && !finishing && <ErrorText>{editor.error}</ErrorText>}
      </div>

      <div className="mt-4 rounded-xl border border-border bg-surface p-2 sm:p-3">
        <SessionBlockList
          editor={editor}
          flow={flow}
          prescriptions={prescriptions}
          catalog={catalog}
          history={history}
          onReplace={(block) => setPicker({ mode: "replace", block })}
          onAdd={() => setPicker({ mode: "add" })}
        />
      </div>

      <div className="mt-8 border-t border-border pt-4">
        {finishing ? (
          <div className="space-y-3">
            <h2 className="text-lg font-semibold">Finish up</h2>
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
                    onChange={setDurationOverride}
                    className="w-20"
                  />
                  <span className="text-muted">min</span>
                </label>
              }
            />
            {endingEarly && flow.current && (
              <Button variant="ghost" size="sm" onClick={() => setEndingEarly(false)}>
                Keep going
              </Button>
            )}
          </div>
        ) : (
          <Button variant="ghost" onClick={() => setEndingEarly(true)}>
            <CheckIcon size={16} /> End early
          </Button>
        )}
      </div>

      {picker !== null && (
        <ExercisePicker
          inSession
          variants={variants}
          recentKeys={recentKeys}
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
              ? exerciseLookup(catalog).exerciseById.get(picker.block.exerciseId)?.pattern
              : undefined
          }
        />
      )}
    </div>
  );
}
