import { DEFAULT_STEADY_SECONDS, EMPTY_CONDITIONING, pieceSeconds } from "./conditioning";
import type { Variant } from "./queries";
import type { ConditioningTarget, RoutineExercise, SetLog } from "./types";
import { isBikeWarmupSet } from "./warmup";

/**
 * Starting shapes for new rows — pure and client-safe (types only), so the
 * routine editor and the live set editor share one set of defaults.
 */

/** A new routine row for `variant`. Stretches get one hold (per side via
 *  unilateralMode), transition-length rest and no RIR — reps-in-reserve is
 *  meaningless for a stretch. A bike piece is one steady 5:00, no target yet. */
export function defaultPrescription(
  routineId: string,
  variant: Variant,
  order: number,
): RoutineExercise {
  const em = variant.exerciseModality;
  const isMobility = variant.pattern === "mobility";
  const isConditioning = variant.pattern === "conditioning";
  const single = isMobility || isConditioning;
  return {
    routineId,
    order,
    exerciseId: em.exerciseId,
    modalityId: em.modalityId,
    bandRole: em.bandRoles[0] ?? null,
    unilateralMode: em.defaultUnilateralMode,
    sets: single ? 1 : 3,
    repMin: isConditioning ? null : 10,
    repMax: isConditioning ? null : 10,
    durationSeconds: isConditioning
      ? DEFAULT_STEADY_SECONDS
      : variant.metricType === "time"
        ? 30
        : null,
    restSeconds: isMobility ? 15 : isConditioning ? 60 : 90,
    targetRir: single ? null : 2,
    supersetGroup: null,
    notes: "",
    conditioning: null,
  };
}

export type LoadPrefill = Pick<SetLog, "weightLbs" | "addedWeightLbs" | "bandId" | "bandRole"> & {
  /** Conditioning variants: the person's next target (conditioningTarget). */
  target?: ConditioningTarget;
};

/** `count` fresh, not-done sets of one variant, numbered from `position`.
 *  A prescription (`rx`) supplies reps/time, unilateral mode and band role;
 *  without one: 10 reps or a 30 s hold. A conditioning variant gets the
 *  prefill's target (or the row's) and the piece's length instead. */
export function freshSets({
  sessionId,
  variant,
  prefill,
  count,
  position,
  rx,
  newSetId,
}: {
  sessionId: string;
  variant: Variant;
  prefill: LoadPrefill;
  count: number;
  position: number;
  rx?: RoutineExercise;
  newSetId: () => string;
}): SetLog[] {
  const em = variant.exerciseModality;
  const timed = variant.metricType === "time";
  const { target, ...load } = prefill;
  const conditioning =
    variant.pattern === "conditioning"
      ? { ...EMPTY_CONDITIONING, ...(target ?? rx?.conditioning) }
      : null;
  return Array.from({ length: count }, (_, i): SetLog => ({
    id: newSetId(),
    sessionId,
    exerciseId: em.exerciseId,
    modalityId: em.modalityId,
    position: position + i,
    setNumber: i + 1,
    unilateralMode: rx?.unilateralMode ?? em.defaultUnilateralMode,
    side: null,
    reps: timed ? null : (rx?.repMax ?? rx?.repMin ?? 10),
    ...load,
    bandRole: rx?.bandRole ?? load.bandRole,
    durationSeconds: conditioning
      ? pieceSeconds({ conditioning, durationSeconds: rx?.durationSeconds ?? null })
      : timed
        ? (rx?.durationSeconds ?? 30)
        : null,
    distanceFeet: null,
    rir: null,
    isWarmup: false,
    completed: false,
    notes: "",
    conditioning,
  }));
}

/**
 * One not-yet-done set moved to another variant (Swap exercise). The load is
 * the person's last-used one for the new variant; the metric fields follow
 * the new exercise — a bike piece gets its target and length, a lift loses
 * the piece's time/distance/readout, a hold gets a time instead of reps.
 * Only the bike warm-up's flag is dropped: whatever it's swapped to is real
 * work now (a squat warm-up swapped to front squat is still a warm-up).
 */
export function swappedSet(
  set: SetLog,
  variant: Variant,
  prefill: LoadPrefill,
  rx?: RoutineExercise,
): SetLog {
  const em = variant.exerciseModality;
  const { target, ...load } = prefill;
  const toBike = variant.pattern === "conditioning";
  const fromBike = set.conditioning !== null || isBikeWarmupSet(set);
  const timed = variant.metricType === "time";
  const base: SetLog = {
    ...set,
    exerciseId: em.exerciseId,
    modalityId: em.modalityId,
    unilateralMode: em.defaultUnilateralMode,
    side: null,
    ...load,
    isWarmup: isBikeWarmupSet(set) ? false : set.isWarmup,
  };
  if (toBike) {
    return {
      ...base,
      reps: null,
      distanceFeet: null,
      conditioning: { ...EMPTY_CONDITIONING, ...target },
      durationSeconds: fromBike ? (set.durationSeconds ?? DEFAULT_STEADY_SECONDS) : DEFAULT_STEADY_SECONDS,
    };
  }
  const wasTimed = set.reps === null && set.durationSeconds !== null && !fromBike;
  return {
    ...base,
    conditioning: null,
    distanceFeet: null,
    reps: timed ? null : fromBike || wasTimed || set.reps === null ? (rx?.repMax ?? 10) : set.reps,
    durationSeconds: timed ? (wasTimed ? set.durationSeconds : (rx?.durationSeconds ?? 30)) : null,
  };
}
