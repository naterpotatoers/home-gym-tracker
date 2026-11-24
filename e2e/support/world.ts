import { addDaysIso, localTodayIso } from "../../src/lib/periods";
import type { Client, ConditioningLog, RoutineExercise, Session, SetLog } from "../../src/lib/types";
import {
  assertVariants,
  deleteWorld,
  e2eClientIds,
  e2eRoutineIds,
  exerciseNames,
  insertClients,
  insertHistory,
  insertRoutine,
} from "./db";

/**
 * A throwaway gym for one test: three people, one routine and a little
 * backdated history, all under ids prefixed `e2e_<tag>_` / `r_e2e_<tag>`, so
 * cleanup can never touch real data. Each test builds its own world and
 * deletes it afterwards (pass or fail), so tests never depend on each other.
 */
export type Person = { id: string; firstName: string };
export type World = {
  tag: string;
  routine: { id: string; name: string };
  alpha: Person;
  beta: Person;
  gamma: Person;
  /** Display name for a catalog id, read from the live DB — specs never
   *  hard-code exercise names, so a rename in /exercises can't break them. */
  name: (exerciseId: string) => string;
};

/** Variants the routine and specs use; checked up front so a catalog change
 *  fails setup with a clear message instead of a confusing UI timeout. */
const VARIANTS = [
  ["squat", "barbell"],
  ["bench_press", "barbell"],
  ["pull_up", "band"],
  ["calf_raise", "dumbbell"],
  ["echo_bike", "cardio"],
  ["goblet_squat", "dumbbell"],
  ["push_up", "bodyweight"],
] as const;

/** Leftovers from a crashed run are swept once they're this old. */
const SWEEP_AFTER_MS = 2 * 60 * 60 * 1000;

function newTag(): string {
  // Time first (8 base-36 chars) so the sweep can tell a leftover's age.
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
}

function tagTime(id: string): number | null {
  const match = /^(?:r_)?e2e_([0-9a-z]{8})/.exec(id);
  return match ? parseInt(match[1], 36) : null;
}

function person(tag: string, key: string, label: string): Client {
  return {
    id: `e2e_${tag}_${key}`,
    firstName: `E2E ${label} ${tag.slice(-3)}`,
    lastName: "Test",
    status: "active",
    joinDate: localTodayIso(),
    dateOfBirth: "1990-01-01",
    heightInches: 70,
    experienceLevel: "intermediate",
    goal: "strength",
    isTrainer: false,
    color: null,
    notes: "Created by the e2e suite — deleted automatically.",
  };
}

function rx(routineId: string, order: number, overrides: Partial<RoutineExercise>): RoutineExercise {
  return {
    routineId,
    order,
    exerciseId: "squat",
    modalityId: "barbell",
    bandRole: null,
    unilateralMode: "bilateral",
    sets: 3,
    repMin: 5,
    repMax: 6,
    durationSeconds: null,
    restSeconds: 30,
    targetRir: 2,
    supersetGroup: null,
    notes: "",
    conditioning: null,
    ...overrides,
  };
}

function session(id: string, clientId: string, date: string, routineId: string): Session {
  return {
    id,
    clientId,
    date,
    assignmentId: null,
    routineId,
    durationMinutes: 45,
    rpe: 7,
    condition: null,
    status: "completed",
    notes: "",
  };
}

function set(sessionId: string, position: number, overrides: Partial<SetLog>): SetLog {
  return {
    id: `${sessionId}_${position}`,
    sessionId,
    exerciseId: "squat",
    modalityId: "barbell",
    position,
    setNumber: position,
    unilateralMode: "bilateral",
    side: null,
    reps: 5,
    weightLbs: null,
    addedWeightLbs: null,
    bandId: null,
    bandRole: null,
    durationSeconds: null,
    distanceFeet: null,
    rir: 2,
    isWarmup: false,
    completed: true,
    notes: "",
    conditioning: null,
    ...overrides,
  };
}

export async function createWorld(): Promise<World> {
  const tag = newTag();
  const today = localTodayIso();
  const routineId = `r_e2e_${tag}`;
  const routine = { id: routineId, name: `E2E Lift ${tag.slice(-3)}`, notes: "" };
  const alpha = person(tag, "alpha", "Alpha");
  const beta = person(tag, "beta", "Beta");
  const gamma = person(tag, "gamma", "Gamma");

  await assertVariants(VARIANTS);
  const names = await exerciseNames([...new Set(VARIANTS.map(([e]) => e))]);

  await insertClients([alpha, beta, gamma]);
  await insertRoutine(routine, [
    rx(routineId, 1, { exerciseId: "squat", modalityId: "barbell", sets: 3, repMin: 5, repMax: 6 }),
    rx(routineId, 2, { exerciseId: "bench_press", modalityId: "barbell", sets: 3, repMin: 6, repMax: 8 }),
    rx(routineId, 3, {
      exerciseId: "pull_up",
      modalityId: "band",
      bandRole: "assistance",
      sets: 2,
      repMin: 6,
      repMax: 10,
      supersetGroup: "a",
    }),
    rx(routineId, 4, {
      exerciseId: "calf_raise",
      modalityId: "dumbbell",
      sets: 2,
      repMin: 10,
      repMax: 15,
      supersetGroup: "a",
    }),
  ]);

  // Alpha, a week ago: a bike warm-up at 150 W (rolls forward as the next
  // target) and squats with a drop set (pre-fill must be the top set, 100).
  const a1 = `e2e_${tag}_alpha_h1`;
  const warmup: ConditioningLog = {
    intervalScheme: "8x20/10",
    targetWatts: 150,
    targetRpm: null,
    avgWatts: 160,
    maxWatts: 300,
    avgRpm: 60,
    calories: 30,
  };
  const alphaSets = [
    set(a1, 1, {
      exerciseId: "echo_bike",
      modalityId: "cardio",
      reps: null,
      rir: null,
      isWarmup: true,
      durationSeconds: 240,
      conditioning: warmup,
    }),
    set(a1, 2, { weightLbs: 100, setNumber: 1 }),
    set(a1, 3, { weightLbs: 100, setNumber: 2 }),
    set(a1, 4, { weightLbs: 100, setNumber: 3 }),
    set(a1, 5, { weightLbs: 80, setNumber: 4 }),
  ];

  // Beta: the same bench for five weekly sessions — a stall.
  const betaSessions = [35, 28, 21, 14, 7].map((daysAgo) =>
    session(`e2e_${tag}_beta_h${daysAgo}`, beta.id, addDaysIso(today, -daysAgo), routineId),
  );
  const betaSets = betaSessions.flatMap((s) =>
    [1, 2, 3].map((n) =>
      set(s.id, n, { exerciseId: "bench_press", modalityId: "barbell", weightLbs: 95, reps: 6, setNumber: n }),
    ),
  );

  await insertHistory(
    [session(a1, alpha.id, addDaysIso(today, -7), routineId), ...betaSessions],
    [...alphaSets, ...betaSets],
  );

  return {
    tag,
    routine,
    alpha,
    beta,
    gamma,
    name: (id) => {
      const n = names[id];
      if (!n) throw new Error(`no e2e name for ${id} — add it to VARIANTS`);
      return n;
    },
  };
}

export async function destroyWorld(world: Pick<World, "tag">) {
  const clientIds = (await e2eClientIds()).filter((id) => id.startsWith(`e2e_${world.tag}_`));
  await deleteWorld(clientIds, [`r_e2e_${world.tag}`]);
}

/** Remove worlds left behind by crashed or killed runs. */
export async function sweepLeftovers(now = Date.now()) {
  const stale = (id: string) => {
    const t = tagTime(id);
    return t === null || now - t > SWEEP_AFTER_MS;
  };
  const clients = (await e2eClientIds()).filter(stale);
  const routines = (await e2eRoutineIds()).filter(stale);
  await deleteWorld(clients, routines);
  return clients.length + routines.length;
}
