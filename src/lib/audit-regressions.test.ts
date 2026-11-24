import { describe, expect, it } from "vitest";
import { seedSnapshot } from "./data/seed-snapshot";
import { buildGymData, type GymData } from "./gym-data";
import { deriveLoadFactor, e1rm, effectiveLoadFactor, setLoad } from "./modality";
import { weightStep } from "./loading";
import { completeAsBodyweight } from "./set-blocks";
import { normalizeSetLog } from "./validate";
import { smartPrefill } from "./planning";
import { describeSet, sessionVolumeLbs } from "./queries";
import type { BandId, RoutineExercise, Session, SetLog, WeighIn } from "./types";

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

describe("smart prefill is last time's load, never a re-target (2026-11-23)", () => {
  it("history outside the prescribed reps pre-fills that load verbatim", () => {
    // 25 × 10 against a 5-rep prescription: 25, not an e1RM-derived 30.
    const s = set({ exerciseId: "goblet_squat", modalityId: "dumbbell", weightLbs: 25 });
    const data = world([session("s_t1", "2026-08-01")], [s]);
    expect(smartPrefill(data, CLIENT, rxFor({}), "2026-08-10")?.weightLbs).toBe(25);
  });

  it("dumbbell pull-up keeps its dumbbell even with a weigh-in", () => {
    const s = set({ exerciseId: "pull_up", modalityId: "dumbbell", weightLbs: 10, reps: 8 });
    const data = world([session("s_t1", "2026-08-01")], [s], [bw("2026-07-01", 180)]);
    const rx = rxFor({ exerciseId: "pull_up" });
    expect(smartPrefill(data, CLIENT, rx, "2026-08-10")?.weightLbs).toBe(10);
  });

  it("dumbbell pull-up without a weigh-in falls back to the last set, never a guess", () => {
    const s = set({ exerciseId: "pull_up", modalityId: "dumbbell", weightLbs: 10, reps: 8 });
    const data = world([session("s_t1", "2026-08-01")], [s]);
    expect(smartPrefill(data, CLIENT, rxFor({ exerciseId: "pull_up" }), "2026-08-10")?.weightLbs).toBe(10);
  });

  it("split squat keeps the per-hand dumbbell", () => {
    const s = set({
      exerciseId: "bulgarian_split_squat",
      modalityId: "dumbbell",
      unilateralMode: "single_side",
      weightLbs: 25,
    });
    const data = world([session("s_t1", "2026-08-01")], [s]);
    const rx = rxFor({ exerciseId: "bulgarian_split_squat", unilateralMode: "single_side" });
    expect(smartPrefill(data, CLIENT, rx, "2026-08-10")?.weightLbs).toBe(25);
  });
});

describe("pre-fill = last time's top set (review R3)", () => {
  const sq = (sessionId: string, position: number, weightLbs: number, reps: number) =>
    set({ sessionId, position, exerciseId: "squat", modalityId: "barbell", weightLbs, reps });
  const rx = rxFor({ exerciseId: "squat", modalityId: "barbell", repMin: 5, repMax: 6 });

  it("a drop set never pre-fills low — the session's top set wins", () => {
    const data = world(
      [session("s_a", "2026-08-01")],
      [sq("s_a", 1, 100, 5), sq("s_a", 2, 100, 5), sq("s_a", 3, 80, 5)],
    );
    expect(smartPrefill(data, CLIENT, rx, "2026-08-08")?.weightLbs).toBe(100);
  });

  const on = (routineId: string | null, id: string, date: string) => ({ ...session(id, date), routineId });

  it("last time on this routine wins after its rep range was edited", () => {
    // Same routine: 65×5 back in May, then the range changed and it was 95×10.
    const data = world(
      [on("r_t", "s_old", "2026-05-01"), on("r_t", "s_new", "2026-08-01")],
      [sq("s_old", 1, 65, 5), sq("s_new", 1, 95, 10)],
    );
    expect(smartPrefill(data, CLIENT, rx, "2026-08-08")?.weightLbs).toBe(95);
  });

  it("a heavy day never pre-fills a volume day, however long ago the volume day was", () => {
    // This routine (5–6 reps) last ran 10 weeks ago at 135; another routine
    // did 115×10 last week.
    const data = world(
      [on("r_t", "s_this", "2026-05-30"), on("r_other", "s_other", "2026-08-01")],
      [sq("s_this", 1, 135, 5), sq("s_other", 1, 115, 10)],
    );
    expect(smartPrefill(data, CLIENT, rx, "2026-08-08")?.weightLbs).toBe(135);
  });

  it("no history on this routine: the latest in-range session, at any age", () => {
    const data = world(
      [on(null, "s_vol", "2026-04-01"), on(null, "s_heavy", "2026-08-01")],
      [sq("s_vol", 1, 135, 5), sq("s_heavy", 1, 115, 10)],
    );
    expect(smartPrefill(data, CLIENT, rx, "2026-08-08")?.weightLbs).toBe(135);
  });

  it("weighted dips with no weigh-in: the top added weight, not the bodyweight drop set", () => {
    const dip = (position: number, addedWeightLbs: number | null, reps: number) =>
      set({ sessionId: "s_d", position, exerciseId: "pull_up", modalityId: "bodyweight", addedWeightLbs, reps });
    const data = world([session("s_d", "2026-08-01")], [dip(1, 25, 8), dip(2, 25, 8), dip(3, null, 12)]);
    const out = smartPrefill(
      data,
      CLIENT,
      rxFor({ exerciseId: "pull_up", modalityId: "bodyweight", repMin: 6, repMax: 10 }),
      "2026-08-08",
    );
    expect(out?.addedWeightLbs).toBe(25);
  });

  it("rated (approximate-lbs) bands: the heavier band is the top set, not the last one", () => {
    const band = (sessionId: string, position: number, bandId: BandId) =>
      set({ sessionId, position, exerciseId: "pallof_press", modalityId: "band", bandId, bandRole: "resistance", weightLbs: null });
    const data = world([session("s_b", "2026-08-01")], [band("s_b", 1, "band_red"), band("s_b", 2, "band_orange")]);
    const out = smartPrefill(data, CLIENT, rxFor({ exerciseId: "pallof_press", modalityId: "band", bandRole: "resistance", repMin: 10, repMax: 10 }), "2026-08-08");
    expect(out?.bandId).toBe("band_red");
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

describe("ankle weights (2026-11)", () => {
  const data = seedSnapshot();
  const session = data.sessions.find((s) => s.clientId === "lidia")!;
  const base = data.setsBySession.get(session.id)![0];
  const ankle = {
    ...base,
    id: "sl_ankle",
    exerciseId: "standing_leg_curl",
    modalityId: "ankle_weight" as const,
    unilateralMode: "single_side" as const,
    weightLbs: 5,
    addedWeightLbs: null,
    bandId: null,
    bandRole: null,
    reps: 12,
    completed: true,
    isWarmup: false,
  };

  it("is exact pounds per ankle (one weight on the working leg), never an e1RM", () => {
    expect(setLoad(data, ankle)).toEqual({ lbs: 5, precision: "exact", totalReps: 24 });
    expect(e1rm(data, ankle)).toBeNull();
  });

  it("progresses by reps with one pair: no heavier step", () => {
    expect(weightStep("ankle_weight")).toBeNull();
  });

  it("a first ankle-weight prescription starts on the pair you own", () => {
    const rx = { ...data.routineExercises[0], exerciseId: "standing_leg_curl", modalityId: "ankle_weight" as const, repMin: 10, repMax: 12, durationSeconds: null };
    expect(smartPrefill(data, "lidia", rx, "2026-11-23")).toMatchObject({ weightLbs: 5, addedWeightLbs: null });
  });

  it("LOG with 'none' (0 lb) becomes the bodyweight variant", () => {
    const out = completeAsBodyweight([{ ...ankle, weightLbs: 0, completed: false }], "sl_ankle", () => true);
    expect(out?.[0]).toMatchObject({ modalityId: "bodyweight", weightLbs: null, completed: true });
  });

  it("normalize drops a stray band or added weight", () => {
    expect(normalizeSetLog({ ...ankle, bandId: "band_red", bandRole: "resistance", addedWeightLbs: 10 })).toMatchObject({
      bandId: null,
      bandRole: null,
      addedWeightLbs: null,
      weightLbs: 5,
    });
  });

  it("a mobility drill logged with reps adds no volume and no e1RM", () => {
    const stretch = { ...base, id: "sl_mob", exerciseId: "band_pass_through", modalityId: "band" as const, bandId: "band_orange" as const, bandRole: "resistance" as const, weightLbs: null, reps: 10, completed: true, isWarmup: false };
    expect(e1rm(data, stretch)).toBeNull();
    const withStretch = buildGymData({ ...data, setLogs: [...data.setLogs, { ...stretch, sessionId: session.id, position: 999 }] });
    expect(sessionVolumeLbs(withStretch, session.id)).toBe(sessionVolumeLbs(data, session.id));
  });
});
