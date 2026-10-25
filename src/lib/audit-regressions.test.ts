import { describe, expect, it } from "vitest";
import { seedSnapshot } from "./data/seed-snapshot";
import { buildGymData, type GymData } from "./gym-data";
import { deriveLoadFactor, effectiveLoadFactor, setLoad } from "./modality";
import { smartPrefill } from "./planning";
import { describeSet, muscleVolume } from "./queries";
import type { RoutineExercise, Session, SetLog, WeighIn } from "./types";

/** Regressions from the 2026-10-24 audit: a seed client with only
 *  the sets each case needs, layered over the seed catalog. */
const seed = seedSnapshot();
const CLIENT = seed.clients[0].id;

function session(id: string, date: string): Session {
  return {
    id,
    clientId: CLIENT,
    date,
    assignmentId: null,
    routineId: null,
    durationMinutes: null,
    rpe: null,
    condition: null,
    status: "completed",
    notes: "",
  };
}

function set(overrides: Partial<SetLog>): SetLog {
  return {
    id: `sl_t_${Math.random().toString(36).slice(2, 10)}`,
    sessionId: "s_t1",
    exerciseId: "squat",
    modalityId: "barbell",
    position: 1,
    setNumber: 1,
    unilateralMode: "bilateral",
    side: null,
    reps: 10,
    weightLbs: null,
    addedWeightLbs: null,
    bandId: null,
    bandRole: null,
    durationSeconds: null,
    distanceFeet: null,
    rir: null,
    isWarmup: false,
    completed: true,
    notes: "",
    ...overrides,
  };
}

/** The seed catalog with ONLY these sessions/sets/weigh-ins. */
function world(sessions: Session[], setLogs: SetLog[], weighIns: WeighIn[] = []): GymData {
  return buildGymData({ ...seed, sessions, setLogs, weighIns });
}

const bw = (date: string, lbs: number): WeighIn => ({
  id: `wi_${date}`,
  clientId: CLIENT,
  date,
  bodyweightLbs: lbs,
});

describe("per-variant dumbbell count", () => {
  it("goblet squat moves one dumbbell", () => {
    const s = set({ exerciseId: "goblet_squat", modalityId: "dumbbell", weightLbs: 50 });
    const data = world([session("s_t1", "2026-08-01")], [s]);
    expect(setLoad(data, s).lbs).toBe(50);
  });

  it("single-side split squat with one dumbbell per hand moves two", () => {
    const s = set({
      exerciseId: "bulgarian_split_squat",
      modalityId: "dumbbell",
      unilateralMode: "single_side",
      weightLbs: 30,
    });
    const data = world([session("s_t1", "2026-08-01")], [s]);
    expect(setLoad(data, s).lbs).toBe(60);
  });

  it("unauthored variants keep the unilateral-mode inference", () => {
    const s = set({ exerciseId: "bicep_curl", modalityId: "dumbbell", weightLbs: 25 });
    const data = world([session("s_t1", "2026-08-01")], [s]);
    expect(setLoad(data, s).lbs).toBe(50);
  });
});

describe("dumbbell-weighted bodyweight movements", () => {
  it("include the lifter's bodyweight", () => {
    const s = set({ exerciseId: "pull_up", modalityId: "dumbbell", weightLbs: 25 });
    const data = world([session("s_t1", "2026-08-01")], [s], [bw("2026-07-01", 180)]);
    expect(setLoad(data, s).lbs).toBe(205);
  });

  it("have no load without a weigh-in", () => {
    const s = set({ exerciseId: "pull_up", modalityId: "dumbbell", weightLbs: 25 });
    const data = world([session("s_t1", "2026-08-01")], [s]);
    expect(setLoad(data, s).lbs).toBeNull();
  });
});

describe("load factors", () => {
  it("bodyweight and band have no seed factor (not comparable to a bar)", () => {
    const data = world([], []);
    expect(deriveLoadFactor(data, CLIENT, "squat", "bodyweight").factor).toBeNull();
    expect(deriveLoadFactor(data, CLIENT, "pull_up", "band").factor).toBeNull();
    expect(deriveLoadFactor(data, CLIENT, "squat", "barbell").factor).toBe(1);
  });

  it("bodyweight history never prefills a barbell weight", () => {
    const sessions = [1, 2, 3].map((d) => session(`s_t${d}`, `2026-08-0${d}`));
    const sets = sessions.flatMap((ses, i) =>
      [1, 2, 3].map((n) =>
        set({
          sessionId: ses.id,
          exerciseId: "squat",
          modalityId: "bodyweight",
          reps: 15,
          position: n,
          setNumber: n,
          id: `sl_bw_${i}_${n}`,
        }),
      ),
    );
    const data = world(sessions, sets, [bw("2026-07-01", 180)]);
    const rx: RoutineExercise = {
      routineId: "r_t",
      order: 1,
      exerciseId: "squat",
      modalityId: "barbell",
      bandRole: null,
      unilateralMode: "bilateral",
      sets: 3,
      repMin: 8,
      repMax: 8,
      durationSeconds: null,
      restSeconds: 90,
      targetRir: 2,
      supersetGroup: null,
      notes: "",
    };
    expect(smartPrefill(data, CLIENT, rx, "2026-08-10")).toBeNull();
  });

  it("a ceiling-limited measurement falls back to the variant override, not the modality seed", () => {
    // Variant override 0.7 on dumbbell bench; sets at the heaviest dumbbell.
    const base = world([], []);
    const exerciseModalities = base.exerciseModalities.map((em) =>
      em.exerciseId === "bench_press" && em.modalityId === "dumbbell"
        ? { ...em, loadFactorOverride: 0.7 }
        : em,
    );
    const sessions = [1, 2, 3].map((d) => session(`s_t${d}`, `2026-08-0${d}`));
    const sets = sessions.flatMap((ses, i) => [
      set({
        id: `sl_bb_${i}`,
        sessionId: ses.id,
        exerciseId: "bench_press",
        modalityId: "barbell",
        weightLbs: 185,
        reps: 5,
      }),
      ...[1, 2].map((n) =>
        set({
          id: `sl_db_${i}_${n}`,
          sessionId: ses.id,
          exerciseId: "bench_press",
          modalityId: "dumbbell",
          weightLbs: 1000, // ≥ the heaviest dumbbell owned
          reps: 12,
          position: n + 1,
          setNumber: n,
        }),
      ),
    ]);
    const data = buildGymData({ ...seed, exerciseModalities, sessions, setLogs: sets, weighIns: [] });
    const derived = deriveLoadFactor(data, CLIENT, "bench_press", "dumbbell");
    expect(derived.source).toBe("measured");
    expect(derived.ceilingLimited).toBe(true);
    expect(effectiveLoadFactor(data, CLIENT, "bench_press", "dumbbell").factor).toBe(0.7);
  });
});

describe("muscleVolume", () => {
  it("counts missing loads as unloaded, never as ordinal band work", () => {
    // Push-ups logged before the first weigh-in: no bodyweight, no load.
    const s = set({ exerciseId: "push_up", modalityId: "bodyweight", reps: 20 });
    const data = world([session("s_t1", "2026-08-01")], [s]);
    const chest = muscleVolume(data, CLIENT).find((v) => v.muscleId === "mid_chest")!;
    expect(chest.ordinalReps).toBe(0);
    expect(chest.unloadedReps).toBeGreaterThan(0);
    expect(chest.sets).toBe(1);
  });
});

describe("describeSet", () => {
  it("shows added weight on bodyweight sets", () => {
    const s = set({ exerciseId: "dip", modalityId: "bodyweight", reps: 8, addedWeightLbs: 45 });
    const data = world([session("s_t1", "2026-08-01")], [s], [bw("2026-07-01", 180)]);
    expect(describeSet(data, s)).toContain("BW+45 lb");
  });
});
