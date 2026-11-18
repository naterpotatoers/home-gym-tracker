import { describe, expect, it } from "vitest";
import { seedSnapshot } from "./data/seed-snapshot";
import { buildGymData, type GymData } from "./gym-data";
import { deriveLoadFactor, effectiveLoadFactor, setLoad } from "./modality";
import { smartPrefill } from "./planning";
import { describeSet } from "./queries";
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
    conditioning: null,
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
      conditioning: null,
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

describe("describeSet", () => {
  it("shows added weight on bodyweight sets", () => {
    const s = set({ exerciseId: "dip", modalityId: "bodyweight", reps: 8, addedWeightLbs: 45 });
    const data = world([session("s_t1", "2026-08-01")], [s], [bw("2026-07-01", 180)]);
    expect(describeSet(data, s)).toContain("BW+45 lb");
  });
});

// ---------------------------------------------------------------------------
// 2026-11-16 audit
// ---------------------------------------------------------------------------

const rxFor = (overrides: Partial<RoutineExercise>): RoutineExercise => ({
  routineId: "r_t",
  order: 1,
  exerciseId: "goblet_squat",
  modalityId: "dumbbell",
  bandRole: null,
  unilateralMode: "bilateral",
  sets: 3,
  repMin: 5,
  repMax: 5,
  durationSeconds: null,
  restSeconds: 90,
  targetRir: 2,
  supersetGroup: null,
  notes: "",
  conditioning: null,
  ...overrides,
});

describe("smart prefill honors the variant's load shape", () => {
  it("goblet squat re-targets the ONE dumbbell, not half of it", () => {
    // 25 × 10 → e1RM 33.3 → 28.6 at 5 reps → the 30, not the 15.
    const s = set({ exerciseId: "goblet_squat", modalityId: "dumbbell", weightLbs: 25 });
    const data = world([session("s_t1", "2026-08-01")], [s]);
    expect(smartPrefill(data, CLIENT, rxFor({}), "2026-08-10")?.weightLbs).toBe(30);
  });

  it("dumbbell pull-up subtracts bodyweight before picking a dumbbell", () => {
    // (180 + 10) × (1 + 8/30) = 240.7 e1RM → 206.3 at 5 reps → 26.3 lb of
    // dumbbell → the 25. Splitting the total would have maxed out the rack.
    const s = set({ exerciseId: "pull_up", modalityId: "dumbbell", weightLbs: 10, reps: 8 });
    const data = world([session("s_t1", "2026-08-01")], [s], [bw("2026-07-01", 180)]);
    const rx = rxFor({ exerciseId: "pull_up" });
    expect(smartPrefill(data, CLIENT, rx, "2026-08-10")?.weightLbs).toBe(25);
  });

  it("dumbbell pull-up without a weigh-in falls back to the last set, never a guess", () => {
    const s = set({ exerciseId: "pull_up", modalityId: "dumbbell", weightLbs: 10, reps: 8 });
    const data = world([session("s_t1", "2026-08-01")], [s]);
    expect(smartPrefill(data, CLIENT, rxFor({ exerciseId: "pull_up" }), "2026-08-10")?.weightLbs).toBe(10);
  });

  it("split squat (one dumbbell per hand) still splits the total", () => {
    const s = set({
      exerciseId: "bulgarian_split_squat",
      modalityId: "dumbbell",
      unilateralMode: "single_side",
      weightLbs: 25,
    });
    const data = world([session("s_t1", "2026-08-01")], [s]);
    const rx = rxFor({ exerciseId: "bulgarian_split_squat", unilateralMode: "single_side" });
    // 50 × 10 → 66.7 → 57.1 at 5 reps → 28.6 per hand → the 30.
    expect(smartPrefill(data, CLIENT, rx, "2026-08-10")?.weightLbs).toBe(30);
  });
});

describe("describeSet dumbbell totals", () => {
  it("never prints a null total", () => {
    const s = set({ exerciseId: "pull_up", modalityId: "dumbbell", weightLbs: 25 });
    const data = world([session("s_t1", "2026-08-01")], [s]);
    expect(describeSet(data, s)).not.toContain("null");
  });

  it("a one-dumbbell variant isn't labeled 'each'", () => {
    const s = set({ exerciseId: "goblet_squat", modalityId: "dumbbell", weightLbs: 50 });
    const data = world([session("s_t1", "2026-08-01")], [s]);
    expect(describeSet(data, s)).toContain("50 lb");
    expect(describeSet(data, s)).not.toContain("ea");
  });

  it("a pair shows per-hand weight and the total", () => {
    const s = set({ exerciseId: "bicep_curl", modalityId: "dumbbell", weightLbs: 25 });
    const data = world([session("s_t1", "2026-08-01")], [s]);
    expect(describeSet(data, s)).toContain("25 lb ea (50 total)");
  });
});
