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
        key: `${set.exerciseId}-${set.modalityId}-${out.length}`,
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
