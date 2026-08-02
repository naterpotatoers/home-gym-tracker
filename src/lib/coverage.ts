import { muscleById, muscleGroups, muscles } from "./data/muscles";
import type { GymData } from "./gym-data";
import { effectiveScores } from "./modality";
import type {
  ExerciseId,
  MuscleGroupId,
  MuscleId,
  RoutineExercise,
} from "./types";

/**
 * Muscle coverage of PRESCRIBED work — routines and program weeks. Unlike
 * `muscleVolume` (logged work, load × reps), prescriptions carry no load, so
 * coverage is set-based: hard-set equivalents, weighted by how directly each
 * exercise trains the muscle.
 */
export type MuscleCoverage = {
  muscleId: MuscleId;
  /** Σ over prescriptions: sets × effectiveScore/10 — hard-set equivalents. */
  weightedSets: number;
  /** Highest effective score seen — how directly this muscle CAN be hit. */
  peakScore: number;
  exerciseIds: ExerciseId[];
};

export function prescribedCoverage(
  rows: readonly RoutineExercise[],
): Map<MuscleId, MuscleCoverage> {
  const out = new Map<MuscleId, MuscleCoverage>();
  for (const muscle of muscles) {
    out.set(muscle.id, {
      muscleId: muscle.id,
      weightedSets: 0,
      peakScore: 0,
      exerciseIds: [],
    });
  }
  for (const row of rows) {
    const scores = effectiveScores(row.exerciseId, row.modalityId);
    for (const [muscleId, score] of scores) {
      const entry = out.get(muscleId);
      if (!entry || score <= 0) continue;
      entry.weightedSets += row.sets * (score / 10);
      entry.peakScore = Math.max(entry.peakScore, score);
      if (!entry.exerciseIds.includes(row.exerciseId)) {
        entry.exerciseIds.push(row.exerciseId);
      }
    }
  }
  return out;
}

/** Coverage of one week of a program: every routine on the week's days,
 *  concatenated. A routine scheduled twice counts twice — it is trained twice. */
export function weekCoverage(
  data: GymData,
  programId: string,
  week: number,
): Map<MuscleId, MuscleCoverage> {
  const rows: RoutineExercise[] = [];
  for (const day of data.programDays) {
    if (day.programId !== programId || day.week !== week) continue;
    rows.push(...(data.exercisesByRoutine.get(day.routineId) ?? []));
  }
  return prescribedCoverage(rows);
}

/**
 * Thresholds, in hard-set equivalents per routine/week:
 * - `neglected` — under 2 weighted sets, or nothing hits it directly
 *   (peak score < 5): the muscle is only along for the ride.
 * - `light`     — under 6 weighted sets: touched, but below a growth dose.
 * - `solid`     — 6+.
 */
export type CoverageStatus = "solid" | "light" | "neglected";

export function coverageStatus(row: MuscleCoverage): CoverageStatus {
  if (row.weightedSets < 2 || row.peakScore < 5) return "neglected";
  if (row.weightedSets < 6) return "light";
  return "solid";
}

/**
 * Status band for LOGGED volume (`MuscleVolume`), relative to the largest bar
 * on screen — the question there is balance, not absolute dose. Ordinal-only
 * muscles (hip-band work: reps, no pounds) are at most `light`, never
 * `neglected` — they are trained, just not lbs-measurable.
 */
export function volumeStatus(
  row: { weightedVolumeLbs: number; ordinalReps: number; peakScore: number },
  max: number,
): CoverageStatus {
  if (row.weightedVolumeLbs === 0 && row.ordinalReps === 0) return "neglected";
  if (row.ordinalReps > 0 && row.weightedVolumeLbs === 0) return "light";
  if (row.peakScore < 5) return "neglected";
  if (max > 0 && row.weightedVolumeLbs < 0.25 * max) return "light";
  return "solid";
}

export type GroupedCoverage = {
  groupId: MuscleGroupId;
  label: string;
  rows: (MuscleCoverage & { name: string; status: CoverageStatus })[];
};

export function coverageByGroup(
  coverage: ReadonlyMap<MuscleId, MuscleCoverage>,
): GroupedCoverage[] {
  return [...muscleGroups]
    .sort((a, b) => a.order - b.order)
    .map((group) => ({
      groupId: group.id,
      label: group.label,
      rows: muscles
        .filter((m) => m.groupId === group.id)
        .map((m) => {
          const row = coverage.get(m.id) ?? {
            muscleId: m.id,
            weightedSets: 0,
            peakScore: 0,
            exerciseIds: [],
          };
          return { ...row, name: m.name, status: coverageStatus(row) };
        }),
    }));
}

/** The muscles a coverage map leaves neglected, named for a callout line. */
export function neglectedMuscles(
  coverage: ReadonlyMap<MuscleId, MuscleCoverage>,
): string[] {
  return [...coverage.values()]
    .filter((row) => coverageStatus(row) === "neglected")
    .map((row) => muscleById.get(row.muscleId)?.name ?? row.muscleId);
}
