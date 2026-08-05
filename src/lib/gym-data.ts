import type {
  Assignment,
  Client,
  Food,
  FoodLog,
  Program,
  ProgramDay,
  Routine,
  RoutineExercise,
  Session,
  SetLog,
  WeighIn,
} from "./types";

/**
 * The mutable half of the domain, as one snapshot. Reference data (muscles,
 * exercises, modalities, equipment, clients) stays in module-level TypeScript
 * where the id unions live; everything here is loaded from the database per
 * request and threaded through the pure query functions as their first
 * argument, so the query layer stays synchronous and testable.
 */
export type GymData = {
  /** Where this snapshot came from. "seed" means the database tables don't
   *  exist yet and the app is running read-only off the TypeScript seed — the
   *  UI shows a setup banner and writes will fail until the migration runs. */
  source: "database" | "seed";
  /** Clients fall back to the TypeScript seed separately, so a database that
   *  ran migration 001 but not 002 keeps working (read-only roster). */
  clientsSource: "database" | "seed";
  /** "missing" while the nutrition tables haven't been created yet — the rest
   *  of the app keeps working; the Tracking tab shows a run-the-SQL note. */
  nutritionSource: "database" | "missing";
  clients: readonly Client[];
  routines: readonly Routine[];
  routineExercises: readonly RoutineExercise[];
  programs: readonly Program[];
  programDays: readonly ProgramDay[];
  assignments: readonly Assignment[];
  sessions: readonly Session[];
  setLogs: readonly SetLog[];
  weighIns: readonly WeighIn[];
  foods: readonly Food[];
  foodLogs: readonly FoodLog[];

  sessionById: ReadonlyMap<string, Session>;
  /** Sets per session, sorted by performed order. */
  setsBySession: ReadonlyMap<string, SetLog[]>;
  routineById: ReadonlyMap<string, Routine>;
  /** Prescriptions per routine, sorted by order. */
  exercisesByRoutine: ReadonlyMap<string, RoutineExercise[]>;
  programById: ReadonlyMap<string, Program>;
  clientById: ReadonlyMap<string, Client>;
  foodById: ReadonlyMap<string, Food>;
};

export type GymTables = Pick<
  GymData,
  | "source"
  | "clientsSource"
  | "clients"
  | "routines"
  | "routineExercises"
  | "programs"
  | "programDays"
  | "assignments"
  | "sessions"
  | "setLogs"
  | "weighIns"
  | "nutritionSource"
  | "foods"
  | "foodLogs"
>;

export function buildGymData(tables: GymTables): GymData {
  const setsBySession = new Map<string, SetLog[]>();
  for (const set of tables.setLogs) {
    const existing = setsBySession.get(set.sessionId);
    if (existing) existing.push(set);
    else setsBySession.set(set.sessionId, [set]);
  }
  for (const list of setsBySession.values()) {
    list.sort((a, b) => a.position - b.position);
  }

  const exercisesByRoutine = new Map<string, RoutineExercise[]>();
  for (const row of tables.routineExercises) {
    const existing = exercisesByRoutine.get(row.routineId);
    if (existing) existing.push(row);
    else exercisesByRoutine.set(row.routineId, [row]);
  }
  for (const list of exercisesByRoutine.values()) {
    list.sort((a, b) => a.order - b.order);
  }

  return {
    ...tables,
    sessionById: new Map(tables.sessions.map((s) => [s.id, s])),
    setsBySession,
    routineById: new Map(tables.routines.map((r) => [r.id, r])),
    exercisesByRoutine,
    programById: new Map(tables.programs.map((p) => [p.id, p])),
    clientById: new Map(tables.clients.map((c) => [c.id, c])),
    foodById: new Map(tables.foods.map((f) => [f.id, f])),
  };
}
