"use client";

import { useState } from "react";
import { ContinuePrompt, type useFinisherAddOns } from "@/components/continue-prompt";
import { ExercisePicker } from "@/components/exercise-picker";
import type { useSessionFlow } from "@/components/use-session-flow";
import type { useSetEditor } from "@/components/use-set-editor";
import type { FinisherOption } from "@/lib/care";
import { exerciseLookup, type ExerciseCatalog } from "@/lib/exercise-catalog";
import type { Variant } from "@/lib/queries";
import type { Block } from "@/lib/set-blocks";
import { swapSuggestions } from "@/lib/similar";

// The Block itself, not its index — a sync landing while the picker is open
// rebuilds the blocks, and a stale index would swap the wrong exercise.
type PickerTarget = { mode: "add" } | { mode: "replace"; block: Block };

/**
 * The add / swap / "continue your workout?" wiring shared by the solo runner
 * and a group-board card: owns the picker target and the finisher append,
 * and hands back ready-to-render pieces. `onBackToLogging` closes the
 * caller's check-in once new sets exist.
 */
export function useSessionActions({
  editor,
  flow,
  addOns,
  variants,
  catalog,
  recentKeys,
  onBackToLogging,
}: {
  editor: ReturnType<typeof useSetEditor>;
  flow: ReturnType<typeof useSessionFlow>;
  addOns: ReturnType<typeof useFinisherAddOns>;
  variants: Variant[];
  catalog: ExerciseCatalog;
  recentKeys?: string[];
  onBackToLogging: () => void;
}) {
  const [picker, setPicker] = useState<PickerTarget | null>(null);
  const [adding, setAdding] = useState(false);

  const openAdd = () => setPicker({ mode: "add" });
  const openReplace = (block: Block) => setPicker({ mode: "replace", block });

  /** A finisher routine: append it; the cursor jumps to its first set. */
  async function continueWith(option: FinisherOption) {
    setAdding(true);
    try {
      const newSets = await editor.addRoutine(option.prescriptions, variants);
      addOns.markAdded(option);
      flow.onExerciseAdded(newSets);
      onBackToLogging();
    } finally {
      setAdding(false);
    }
  }

  const continuePrompt = (
    <ContinuePrompt
      options={addOns.remaining}
      disabled={editor.busy}
      pending={adding}
      onRoutine={continueWith}
      onExercise={openAdd}
    />
  );

  const pickerElement = picker && (
    <ExercisePicker
      inSession
      variants={variants}
      recentKeys={recentKeys}
      onSelect={async (variant) => {
        const target = picker;
        setPicker(null);
        if (target.mode === "add") {
          flow.onExerciseAdded(await editor.addExercise(variant));
          onBackToLogging(); // added from the check-in: back to logging
        } else {
          editor.swapExercise(target.block, variant);
        }
      }}
      onClose={() => setPicker(null)}
      suggestions={
        picker.mode === "replace" ? swapSuggestions(catalog, variants, picker.block) : undefined
      }
      emphasizePattern={
        picker.mode === "replace"
          ? exerciseLookup(catalog).exerciseById.get(picker.block.exerciseId)?.pattern
          : undefined
      }
    />
  );

  return { openAdd, openReplace, continuePrompt, pickerElement };
}
