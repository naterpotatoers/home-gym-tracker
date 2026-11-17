import type { SetLog } from "./types";

/** A consecutive run of sets on the same exercise × modality, in performed
 *  order — the client-side counterpart of queries.ts `blocksFor`. */
export type Block = {
  key: string;
  exerciseId: SetLog["exerciseId"];
  modalityId: SetLog["modalityId"];
  sets: SetLog[];
};

export function toBlocks(sets: readonly SetLog[]): Block[] {
  const out: Block[] = [];
  for (const set of sets) {
    const last = out.at(-1);
    if (last && last.exerciseId === set.exerciseId && last.modalityId === set.modalityId) {
      last.sets.push(set);
    } else {
      out.push({
        // The first set's id: stable across inserts/removals elsewhere in
        // the session (an index-based key would remount lower blocks and
        // collapse a block the user opened).
        key: set.id,
        exerciseId: set.exerciseId,
        modalityId: set.modalityId,
        sets: [set],
      });
    }
  }
  return out;
}

/** Re-derive position (session-wide) and setNumber (within each consecutive
 *  exercise × modality block) after any structural change. */
export function renumber(sets: SetLog[]): SetLog[] {
  let setNumber = 0;
  return sets.map((set, index) => {
    const prev = sets[index - 1];
    setNumber =
      prev && prev.exerciseId === set.exerciseId && prev.modalityId === set.modalityId
        ? setNumber + 1
        : 1;
    return { ...set, position: index + 1, setNumber };
  });
}

/** Prescription fields that roll forward when edited — "update once, rolls
 *  out". completed/notes/rir are per-set facts and never cascade. */
export const CASCADE_KEYS = [
  "weightLbs",
  "addedWeightLbs",
  "bandId",
  "bandRole",
  "reps",
  "durationSeconds",
  "distanceFeet",
] as const;

/**
 * Which later sets an edit should also apply to: the not-yet-performed sets
 * after the edited one in its exercise block, up to the first completed set.
 * Works whether or not the edited set is itself completed, so fixing a set
 * that was logged too early also fixes the sets still to do — but once a
 * later set has been performed, nothing past the edit is rewritten. Only
 * sets with the same warm-up flag follow, so working-set edits never touch
 * warm-ups (and vice versa).
 */
export function cascadeTargets(
  sets: readonly SetLog[],
  targetId: string,
  changes: Partial<SetLog>,
): string[] {
  if (!CASCADE_KEYS.some((key) => key in changes)) return [];
  const block = toBlocks(sets).find((b) => b.sets.some((s) => s.id === targetId));
  if (!block) return [];
  const index = block.sets.findIndex((s) => s.id === targetId);
  const target = block.sets[index];
  const out: string[] = [];
  for (const set of block.sets.slice(index + 1)) {
    if (set.completed) break;
    if (set.isWarmup === target.isWarmup) out.push(set.id);
  }
  return out;
}

/** The subset of `changes` that cascades (see CASCADE_KEYS). */
export function cascadePatch(changes: Partial<SetLog>): Partial<SetLog> {
  const patch: Partial<SetLog> = {};
  for (const key of CASCADE_KEYS) {
    if (key in changes) (patch as Record<string, unknown>)[key] = changes[key];
  }
  return patch;
}

/**
 * LOG for a dumbbell/barbell set entered at 0 lb: that's bodyweight work, so
 * it's recorded as the exercise's bodyweight variant (weights cleared). The
 * block's other 0 lb sets switch with it, so it stays one block. Null when
 * the rule doesn't apply — not 0 lb, or the exercise has no bodyweight
 * variant (`hasBodyweight`) — and the caller just marks the set done.
 */
export function completeAsBodyweight(
  sets: readonly SetLog[],
  setId: string,
  hasBodyweight: (exerciseId: string) => boolean,
): SetLog[] | null {
  const target = sets.find((s) => s.id === setId);
  if (
    !target ||
    target.weightLbs !== 0 ||
    (target.modalityId !== "dumbbell" && target.modalityId !== "barbell") ||
    !hasBodyweight(target.exerciseId)
  ) {
    return null;
  }
  const block = toBlocks(sets).find((b) => b.sets.some((s) => s.id === setId));
  const convert = new Set(block?.sets.filter((s) => s.weightLbs === 0).map((s) => s.id));
  return sets.map((s) =>
    convert.has(s.id)
      ? {
          ...s,
          modalityId: "bodyweight",
          weightLbs: null,
          addedWeightLbs: null,
          completed: s.completed || s.id === setId,
        }
      : s,
  );
}
