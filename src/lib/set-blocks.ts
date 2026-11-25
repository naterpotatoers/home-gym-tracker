import { EMPTY_CONDITIONING, targetOf } from "./conditioning";
import type { SetLog } from "./types";
import { isBikeWarmupSet } from "./warmup";

/** A consecutive run of sets on the same exercise × modality, in performed
 *  order — the client-side counterpart of queries.ts `blocksFor`. */
export type Block = {
  key: string;
  exerciseId: SetLog["exerciseId"];
  modalityId: SetLog["modalityId"];
  sets: SetLog[];
};

type BlockFields = Pick<SetLog, "exerciseId" | "modalityId" | "isWarmup">;

/** Whether two adjacent sets belong to one block: same exercise × modality,
 *  and both or neither the bike warm-up — so the warm-up never merges with
 *  an Echo Bike piece right after it (its own tag, rx line and Skip/Remove).
 *  A strength set toggled to warm-up stays in its exercise's block. */
export function sameBlock(a: BlockFields, b: BlockFields): boolean {
  return (
    a.exerciseId === b.exerciseId &&
    a.modalityId === b.modalityId &&
    isBikeWarmupSet(a) === isBikeWarmupSet(b)
  );
}

export function toBlocks(sets: readonly SetLog[]): Block[] {
  const out: Block[] = [];
  for (const set of sets) {
    const last = out.at(-1);
    if (last && sameBlock(last.sets.at(-1)!, set)) {
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
    setNumber = prev && sameBlock(prev, set) ? setNumber + 1 : 1;
    return { ...set, position: index + 1, setNumber };
  });
}

/**
 * "Add set": the next set of a block, planned like its last one. A lift
 * copies load and reps as they are. A bike piece copies the plan only (its
 * length and target) — the average, distance and effort belong to the piece
 * that was ridden.
 */
export function nextSetLike(template: SetLog, id: string): SetLog {
  const next = { ...template, id, completed: false };
  if (template.conditioning === null) return next;
  return {
    ...next,
    distanceFeet: null,
    conditioning: { ...EMPTY_CONDITIONING, ...targetOf(template.conditioning) },
  };
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
  const block = toBlocks(sets).find((b) => b.sets.some((s) => s.id === targetId));
  if (!block) return [];
  const index = block.sets.findIndex((s) => s.id === targetId);
  const target = block.sets[index];
  if (!cascades(target, changes)) return [];
  const out: string[] = [];
  for (const set of block.sets.slice(index + 1)) {
    if (set.completed) break;
    if (set.isWarmup === target.isWarmup) out.push(set.id);
  }
  return out;
}

/** Whether an edit to `target` (as it was before the edit) is a prescription
 *  change. A bike piece's prescription is its length and the target half of
 *  `conditioning` (scheme, watts, RPM); everything else on it — distance
 *  included — is what the console read, a per-piece fact. */
function cascades(target: SetLog, changes: Partial<SetLog>): boolean {
  if (target.conditioning === null) return CASCADE_KEYS.some((key) => key in changes);
  if ("durationSeconds" in changes) return true;
  const next = changes.conditioning;
  if (next == null) return false;
  const [a, b] = [targetOf(next), targetOf(target.conditioning)];
  return a.intervalScheme !== b.intervalScheme || a.targetWatts !== b.targetWatts || a.targetRpm !== b.targetRpm;
}

/**
 * A later set (one of cascadeTargets) with the cascading part of `changes`
 * applied. A lift takes the CASCADE_KEYS fields. A bike piece takes the new
 * length and target — so piece 1's "250 W" or a switch to 30/30 reaches the
 * pieces still to ride — and keeps its own readout.
 */
export function cascadeInto(set: SetLog, changes: Partial<SetLog>): SetLog {
  if (set.conditioning === null) return { ...set, ...cascadePatch(changes) };
  return {
    ...set,
    ...("durationSeconds" in changes ? { durationSeconds: changes.durationSeconds ?? null } : {}),
    conditioning: changes.conditioning
      ? { ...EMPTY_CONDITIONING, ...set.conditioning, ...targetOf(changes.conditioning) }
      : set.conditioning,
  };
}

/** The subset of `changes` that cascades for a lift (see CASCADE_KEYS). */
export function cascadePatch(changes: Partial<SetLog>): Partial<SetLog> {
  const patch: Partial<SetLog> = {};
  for (const key of CASCADE_KEYS) {
    if (key in changes) (patch as Record<string, unknown>)[key] = changes[key];
  }
  return patch;
}

/**
 * LOG for a dumbbell/barbell/ankle-weight set entered at 0 lb (ankle: "none")
 * — that's bodyweight work, so
 * it's recorded as the exercise's bodyweight variant (weights cleared). The
 * block's other 0 lb sets switch with it, so it stays one block. Null when
 * the rule doesn't apply — not 0 lb, or the exercise has no bodyweight
 * variant (`hasBodyweight`) — and the caller just marks the set done.
 */
const ZERO_IS_BODYWEIGHT: ReadonlySet<SetLog["modalityId"]> = new Set(["dumbbell", "barbell", "ankle_weight"]);

export function completeAsBodyweight(
  sets: readonly SetLog[],
  setId: string,
  hasBodyweight: (exerciseId: string) => boolean,
): SetLog[] | null {
  const target = sets.find((s) => s.id === setId);
  if (
    !target ||
    target.weightLbs !== 0 ||
    !ZERO_IS_BODYWEIGHT.has(target.modalityId) ||
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
