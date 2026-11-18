import { EMPTY_TARGET, pieceLabel, readoutLabel, targetLabel } from "./conditioning";
import { bandById } from "./data/equipment";
import { variantKey } from "./exercise-catalog";
import { mmss } from "./periods";
import type { StallHint } from "./progression";
import { toBlocks } from "./set-blocks";
import type { ModalityId, RoutineExercise, SetLog } from "./types";
import { BIKE_WARMUP_RX, isBikeWarmupBlock, isBikeWarmupSet, WARMUP_EFFORT, WARMUP_MINUTES } from "./warmup";

/** Pure label + cursor helpers for the live session cards — extracted so the
 *  self-healing cursor logic is unit-testable outside the client component. */

/** How many of a session's sets are done — the "3/8 sets" numerator. */
export function completedCount(sets: readonly SetLog[]): number {
  return sets.filter((s) => s.completed).length;
}

/** Short band name for labels — "blue", "small". Shared so every surface
 *  renders bands identically. */
export function bandLabel(set: Pick<SetLog, "bandId">): string {
  return set.bandId?.replace(/^(band|hip_band)_/, "").replace(/_/g, "/") ?? "";
}

type LoadFields = Pick<SetLog, "modalityId" | "bandId" | "bandRole" | "weightLbs" | "addedWeightLbs">;

/**
 * The load half of every set label, as entered — the one band / bodyweight /
 * weight ladder. Compact: "135", "50" (per dumbbell), "BW+25", "BW", "blue",
 * "−green" (assist), "small band" (hip band: ordinal, never pounds).
 * Verbose adds units: "135 lb", "BW+25 lb", "blue band", "−green band
 * assist". Null when no load is entered.
 */
export function loadLabel(set: LoadFields, { verbose = false } = {}): string | null {
  if (set.bandId) {
    const name = bandLabel(set);
    if (bandById.get(set.bandId)?.family === "hip") return `${name} band`;
    if (set.bandRole === "assistance") return verbose ? `−${name} band assist` : `−${name}`;
    return verbose ? `${name} band` : name;
  }
  if (set.modalityId === "bodyweight") {
    if (!set.addedWeightLbs) return "BW";
    return verbose ? `BW+${set.addedWeightLbs} lb` : `BW+${set.addedWeightLbs}`;
  }
  if (set.weightLbs === null) return null;
  return verbose ? `${set.weightLbs} lb` : String(set.weightLbs);
}

/** Terse one-set label for history chips — "135×10", "50×10" (per
 *  dumbbell, as entered), "BW+25×8", "blue×12", "−green×6" (assist),
 *  "medium band×15" (hip band: ordinal, never pounds), "30s", "×10/side".
 *  "F" marks a set taken to failure. */
export function compactSet(set: SetLog): string {
  if (set.conditioning) return conditioningSetLabel(set);
  const what = loadLabel(set) ?? "";
  let amount = "";
  if (set.durationSeconds !== null) amount = `${set.durationSeconds}s`;
  else if (set.distanceFeet !== null) amount = `${set.distanceFeet}ft`;
  else if (set.reps !== null) {
    amount = `${set.reps}${set.unilateralMode !== "bilateral" ? "/side" : ""}`;
  }
  const label = what && amount ? `${what}×${amount}` : what || amount || "—";
  return set.rir === 0 ? `${label} F` : label;
}

/** A bike piece: "8 × 20/10 · 182 W avg (410 max) · 64 rpm · 38 cal", or
 *  "5:00 steady · target 55 rpm" before anything is entered. */
export function conditioningSetLabel(set: SetLog): string {
  const log = set.conditioning;
  const piece = pieceLabel(log?.intervalScheme ?? null, set.durationSeconds);
  if (!log) return piece;
  const result = readoutLabel(log, set.distanceFeet);
  const target = targetLabel(log);
  return [piece, result ?? (target ? `target ${target}` : null)].filter(Boolean).join(" · ");
}

/** "3×10", "3×8–12", or "1×30s" — the high-level scheme, no RIR/rest. A bike
 *  row: "8 × 20/10 @ 200 W" or "5:00 steady @ 55 rpm". */
export function schemeLabel(rx: RoutineExercise): string {
  if (rx.conditioning) {
    const piece = pieceLabel(rx.conditioning.intervalScheme, rx.durationSeconds);
    const target = targetLabel(rx.conditioning);
    return `${rx.sets > 1 ? `${rx.sets}× ` : ""}${piece}${target ? ` @ ${target}` : ""}`;
  }
  if (rx.durationSeconds !== null) return `${rx.sets}×${rx.durationSeconds}s`;
  if (rx.repMin !== null && rx.repMax !== null && rx.repMin !== rx.repMax) {
    return `${rx.sets}×${rx.repMin}–${rx.repMax}`;
  }
  return `${rx.sets}×${rx.repMax ?? rx.repMin ?? "?"}`;
}

/** "3×10 @ RIR 2 · rest 90s" — the scheme plus intensity and rest. `bike`:
 *  a conditioning row even with no scheme or target saved yet. */
export function rxLabel(rx: RoutineExercise, bike = Boolean(rx.conditioning)): string {
  if (bike) {
    return `${schemeLabel({ ...rx, conditioning: rx.conditioning ?? EMPTY_TARGET })} · rest ${rx.restSeconds}s`;
  }
  return `${schemeLabel(rx)}${rx.targetRir !== null ? ` @ RIR ${rx.targetRir}` : ""} · rest ${rx.restSeconds}s`;
}

/** First index at or after `from` that isn't completed. Forward-only: never
 *  wraps back to earlier (deliberately skipped) sets. */
export function nextIncomplete(sets: readonly SetLog[], from: number): number {
  for (let i = Math.max(from, 0); i < sets.length; i++) {
    if (!sets[i].completed) return i;
  }
  return -1;
}

/** Resolve an id-based cursor to the set the LOG hero should show.
 *  - the set itself, while it exists and is incomplete
 *  - if it completed, the first incomplete set AFTER it (never behind), so a
 *    cursor parked on the session's last logged set self-recovers when new
 *    sets are appended
 *  - null, or an id that no longer exists (removed without re-aiming) →
 *    parked: nothing to log
 *  Never scans backward — skipped sets stay skipped. */
export function resolveCursor(sets: readonly SetLog[], cursorId: string | null): SetLog | null {
  if (cursorId === null) return null;
  const at = sets.findIndex((s) => s.id === cursorId);
  if (at === -1) return null;
  const next = nextIncomplete(sets, sets[at].completed ? at + 1 : at);
  return next === -1 ? null : sets[next];
}

/** Id of the first incomplete set strictly after `fromId` — where the cursor
 *  lands after LOG. The caller marks `fromId` complete separately, so this
 *  looks only at what's ahead of it. Null = nothing ahead. */
export function advanceCursor(sets: readonly SetLog[], fromId: string): string | null {
  const at = sets.findIndex((s) => s.id === fromId);
  if (at === -1) return null;
  const next = nextIncomplete(sets, at + 1);
  return next === -1 ? null : sets[next].id;
}

type VariantFields = Pick<SetLog, "exerciseId" | "modalityId"> &
  Partial<Pick<SetLog, "isWarmup">>;

/** Rest after a set with no prescription (an exercise added mid-session). */
export const DEFAULT_REST_SECONDS = 90;

/** The routine's prescription for a set's variant, if it has one. The bike
 *  warm-up has its own (BIKE_WARMUP_RX), so a later Echo Bike finisher block
 *  keeps the finisher's row and the warm-up never borrows it. */
export function prescriptionFor(
  prescriptions: readonly RoutineExercise[],
  set: VariantFields,
): RoutineExercise | undefined {
  if (set.isWarmup !== undefined && isBikeWarmupSet({ ...set, isWarmup: set.isWarmup })) {
    return BIKE_WARMUP_RX;
  }
  return prescriptions.find(
    (p) => p.exerciseId === set.exerciseId && p.modalityId === set.modalityId,
  );
}

/** A block's prescription — the warm-up's when every set is the bike
 *  warm-up (a squat set toggled to warm-up keeps the squat row). */
export function blockPrescription(
  prescriptions: readonly RoutineExercise[],
  block: { exerciseId: string; modalityId: SetLog["modalityId"]; sets: readonly SetLog[] },
): RoutineExercise | undefined {
  if (isBikeWarmupBlock(block)) return BIKE_WARMUP_RX;
  return prescriptionFor(prescriptions, { exerciseId: block.exerciseId, modalityId: block.modalityId });
}

/** "5:00 steady · easy, RPE 3–4 · rest 60s" — the warm-up's rx line. */
export function warmupRxLabel(rx: Pick<RoutineExercise, "durationSeconds" | "restSeconds">): string {
  return `${mmss(rx.durationSeconds ?? WARMUP_MINUTES * 60)} steady · easy, ${WARMUP_EFFORT} · rest ${rx.restSeconds}s`;
}

type BlockFields = {
  exerciseId: string;
  modalityId: ModalityId;
  sets: readonly SetLog[];
};

/** The rx line under an open block's name, null without a prescription: the
 *  warm-up's own line; a bike piece's shape and rest only (each person's
 *  target is on their piece, so the row's default isn't repeated); else the
 *  lift's rxLabel. */
export function blockRxLine(
  rx: RoutineExercise | undefined,
  block: BlockFields,
  isBike: boolean,
): string | null {
  if (!rx) return null;
  if (isBikeWarmupBlock(block)) return warmupRxLabel(rx);
  if (isBike) {
    return `${pieceLabel(rx.conditioning?.intervalScheme ?? null, rx.durationSeconds)} · rest ${rx.restSeconds}s`;
  }
  return rxLabel(rx);
}

/** A block's stall hint — only while it has sets left to log: a finished
 *  block's stall is old news. */
export function blockStall(
  block: BlockFields,
  stalls: Readonly<Record<string, StallHint>>,
): StallHint | undefined {
  if (completedCount(block.sets) === block.sets.length) return undefined;
  return stalls[variantKey(block.exerciseId, block.modalityId)];
}

/** Where block `index` sits among adjacent blocks sharing a superset label
 *  (`labels` per block, matching performOrder, which only interleaves
 *  adjacent runs): in a run at all, and whether it starts one — where the
 *  "superset" tag goes. */
export function supersetPosition(
  labels: readonly (string | undefined)[],
  index: number,
): { inSuperset: boolean; starts: boolean } {
  const label = labels[index];
  if (label === undefined) return { inSuperset: false, starts: false };
  const prevSame = index > 0 && labels[index - 1] === label;
  const nextSame = labels[index + 1] === label;
  return { inSuperset: prevSame || nextSame, starts: nextSame && !prevSame };
}

/**
 * Seconds of rest to start after logging `logged`, or null for none. No rest
 * inside a superset pair — the "rest" is the partner exercise; the
 * prescription's rest applies once the round hands back to a new exercise
 * (or the pair is done). `next` is where the cursor goes (undefined = none).
 */
export function restAfterLog(
  logged: VariantFields,
  next: VariantFields | undefined,
  prescriptions: readonly RoutineExercise[],
  supersets: ReadonlyMap<string, string>,
): number | null {
  const key = variantKey(logged.exerciseId, logged.modalityId);
  const label = supersets.get(key);
  if (next && label !== undefined) {
    const nextKey = variantKey(next.exerciseId, next.modalityId);
    if (nextKey !== key && supersets.get(nextKey) === label) return null;
  }
  return prescriptionFor(prescriptions, logged)?.restSeconds ?? DEFAULT_REST_SECONDS;
}

/** Variant key → superset label, for prescriptions that declare one. */
export function supersetGroups(
  prescriptions: readonly RoutineExercise[],
): Map<string, string> {
  const out = new Map<string, string>();
  for (const rx of prescriptions) {
    if (rx.supersetGroup) {
      out.set(variantKey(rx.exerciseId, rx.modalityId), rx.supersetGroup);
    }
  }
  return out;
}

/**
 * The session's sets in intended PERFORMANCE order: adjacent blocks sharing a
 * superset label interleave round by round (A1 B1 A2 B2 A3 — unequal set
 * counts degrade naturally); everything else keeps list order. Storage stays
 * grouped — only the cursor walks this ordering, so blocks, the load cascade,
 * and renumbering are untouched. Identity when no labels are declared.
 */
export function performOrder(
  sets: readonly SetLog[],
  groups: ReadonlyMap<string, string>,
): SetLog[] {
  if (groups.size === 0) return [...sets];
  const blocks = toBlocks(sets);
  const out: SetLog[] = [];
  let i = 0;
  while (i < blocks.length) {
    const label = groups.get(variantKey(blocks[i].exerciseId, blocks[i].modalityId));
    if (label === undefined) {
      out.push(...blocks[i].sets);
      i++;
      continue;
    }
    // Gather the adjacent run sharing this label, then round-robin its sets.
    let j = i;
    while (
      j < blocks.length &&
      groups.get(variantKey(blocks[j].exerciseId, blocks[j].modalityId)) === label
    ) {
      j++;
    }
    const run = blocks.slice(i, j);
    const rounds = Math.max(...run.map((b) => b.sets.length));
    for (let round = 0; round < rounds; round++) {
      for (const block of run) {
        const set = block.sets[round];
        if (set) out.push(set);
      }
    }
    i = j;
  }
  return out;
}

/**
 * Where the live block list folds into one "Later: …" row: everything up to
 * and including the current block, plus the next one, stays a row; a
 * superset run is never split; a manually opened block is never folded away.
 * `labels[i]` is block i's superset label. Null = no fold (no current block,
 * or fewer than two blocks would fold).
 */
export function upcomingFoldIndex(
  labels: readonly (string | undefined)[],
  currentIndex: number,
  expandedIndex: number,
): number | null {
  if (currentIndex < 0) return null;
  let cut = currentIndex + 2;
  while (cut < labels.length && labels[cut] !== undefined && labels[cut] === labels[cut - 1]) {
    cut++;
  }
  cut = Math.max(cut, expandedIndex + 1);
  return labels.length - cut >= 2 ? cut : null;
}

/** A progression load in words — "150 lb", "BW+25 lb", "BW". */
function progressionLoad(modalityId: ModalityId, load: number): string {
  const bodyweight = modalityId === "bodyweight";
  return (
    loadLabel(
      {
        modalityId,
        bandId: null,
        bandRole: null,
        weightLbs: bodyweight ? null : load,
        addedWeightLbs: bodyweight && load > 0 ? load : null,
      },
      { verbose: true },
    ) ?? `${load} lb`
  );
}

/** The runner's stall callout, headline then what to do — "No progress in
 *  4 wk (3 sessions) — every set hit 10: try 150 lb × 8–10". */
export function stallCallout(hint: StallHint, modalityId: ModalityId): string {
  const weeks = Math.floor(hint.days / 7);
  const head = `No progress in ${weeks} wk (${hint.exposures} sessions)`;
  const s = hint.suggestion;
  switch (s.kind) {
    case "add_load": {
      const reps = s.repMin === s.repMax ? `${s.repMax}` : `${s.repMin}–${s.repMax}`;
      return `${head} — every set hit ${s.repMax}: try ${progressionLoad(modalityId, s.load)} × ${reps}`;
    }
    case "same_load":
      return `${head} — stay at ${progressionLoad(modalityId, s.load)} and work every set up to ${s.targetReps} (last ${s.lastReps.join("/")})`;
    case "at_ceiling": {
      const why =
        modalityId === "dumbbell"
          ? "already on the heaviest dumbbells"
          : modalityId === "bodyweight" && s.load === 0
            ? `every set hit ${Math.min(...s.lastReps)}`
            : "no heavier step to take";
      const what = modalityId === "bodyweight" && s.load === 0 ? "add reps or hold a dumbbell" : "add reps or slow the tempo";
      return `${head} — ${why}: ${what}`;
    }
  }
}

