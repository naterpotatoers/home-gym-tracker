import type {
  Client,
  Assignment,
  Program,
  ProgramDay,
  Routine,
  RoutineExercise,
  Session,
  SetLog,
  WeighIn,
} from "../types";

/**
 * snake_case rows ↔ camelCase domain types, both directions for every mutable
 * table. Postgres `date` columns round-trip as "YYYY-MM-DD" strings, matching
 * the app's date convention, so no date conversion happens here.
 *
 * `RoutineExercise.order` maps to the `sort_order` column — "order" is a
 * reserved word in SQL.
 *
 * The Row types below mirror `supabase/schema.sql` column-for-column,
 * with field types borrowed from the domain types so a change to either side
 * (renamed column, retyped field, new column) is a compile error in BOTH
 * mapper directions rather than a silent `undefined` at runtime.
 */

export type RoutineRow = {
  id: string;
  name: string;
  notes: string;
};

export type RoutineExerciseRow = {
  routine_id: string;
  sort_order: number;
  exercise_id: RoutineExercise["exerciseId"];
  modality_id: RoutineExercise["modalityId"];
  band_role: RoutineExercise["bandRole"];
  unilateral_mode: RoutineExercise["unilateralMode"];
  sets: number;
  rep_min: number | null;
  rep_max: number | null;
  duration_seconds: number | null;
  rest_seconds: number;
  target_rir: number | null;
  superset_group: string | null;
  notes: string;
};

export type ProgramRow = {
  id: string;
  name: string;
  weeks: number;
  notes: string;
};

export type ProgramDayRow = {
  program_id: string;
  week: number;
  day_of_week: number;
  routine_id: string;
};

export type AssignmentRow = {
  id: string;
  program_id: string;
  client_id: Assignment["clientId"];
  start_date: string;
  status: Assignment["status"];
};

export type SessionRow = {
  id: string;
  client_id: Session["clientId"];
  date: string;
  assignment_id: string | null;
  routine_id: string | null;
  duration_minutes: number | null;
  rpe: number | null;
  condition: Session["condition"];
  status: Session["status"];
  notes: string;
};

export type SetLogRow = {
  id: string;
  session_id: string;
  position: number;
  exercise_id: SetLog["exerciseId"];
  modality_id: SetLog["modalityId"];
  set_number: number;
  unilateral_mode: SetLog["unilateralMode"];
  side: SetLog["side"];
  reps: number | null;
  weight_lbs: number | null;
  added_weight_lbs: number | null;
  band_id: SetLog["bandId"];
  band_role: SetLog["bandRole"];
  duration_seconds: number | null;
  distance_feet: number | null;
  rir: number | null;
  is_warmup: boolean;
  completed: boolean;
  notes: string;
};

export type ClientRow = {
  id: string;
  first_name: string;
  last_name: string;
  status: Client["status"];
  join_date: string;
  date_of_birth: string;
  height_inches: number;
  experience_level: Client["experienceLevel"];
  goal: Client["goal"];
  is_trainer: boolean;
  color: string | null;
  notes: string;
};

export type WeighInRow = {
  id: string;
  client_id: WeighIn["clientId"];
  date: string;
  bodyweight_lbs: number;
};

export function rowToRoutine(r: RoutineRow): Routine {
  return { id: r.id, name: r.name, notes: r.notes };
}

export function routineToRow(r: Routine): RoutineRow {
  return { id: r.id, name: r.name, notes: r.notes };
}

export function rowToRoutineExercise(r: RoutineExerciseRow): RoutineExercise {
  return {
    routineId: r.routine_id,
    order: r.sort_order,
    exerciseId: r.exercise_id,
    modalityId: r.modality_id,
    bandRole: r.band_role,
    unilateralMode: r.unilateral_mode,
    sets: r.sets,
    repMin: r.rep_min,
    repMax: r.rep_max,
    durationSeconds: r.duration_seconds,
    restSeconds: r.rest_seconds,
    targetRir: r.target_rir,
    supersetGroup: r.superset_group,
    notes: r.notes,
  };
}

export function routineExerciseToRow(e: RoutineExercise): RoutineExerciseRow {
  return {
    routine_id: e.routineId,
    sort_order: e.order,
    exercise_id: e.exerciseId,
    modality_id: e.modalityId,
    band_role: e.bandRole,
    unilateral_mode: e.unilateralMode,
    sets: e.sets,
    rep_min: e.repMin,
    rep_max: e.repMax,
    duration_seconds: e.durationSeconds,
    rest_seconds: e.restSeconds,
    target_rir: e.targetRir,
    superset_group: e.supersetGroup,
    notes: e.notes,
  };
}

export function rowToProgram(r: ProgramRow): Program {
  return { id: r.id, name: r.name, weeks: r.weeks, notes: r.notes };
}

export function programToRow(p: Program): ProgramRow {
  return { id: p.id, name: p.name, weeks: p.weeks, notes: p.notes };
}

export function rowToProgramDay(r: ProgramDayRow): ProgramDay {
  return {
    programId: r.program_id,
    week: r.week,
    dayOfWeek: r.day_of_week,
    routineId: r.routine_id,
  };
}

export function programDayToRow(d: ProgramDay): ProgramDayRow {
  return {
    program_id: d.programId,
    week: d.week,
    day_of_week: d.dayOfWeek,
    routine_id: d.routineId,
  };
}

export function rowToAssignment(r: AssignmentRow): Assignment {
  return {
    id: r.id,
    programId: r.program_id,
    clientId: r.client_id,
    startDate: r.start_date,
    status: r.status,
  };
}

export function assignmentToRow(a: Assignment): AssignmentRow {
  return {
    id: a.id,
    program_id: a.programId,
    client_id: a.clientId,
    start_date: a.startDate,
    status: a.status,
  };
}

export function rowToSession(r: SessionRow): Session {
  return {
    id: r.id,
    clientId: r.client_id,
    date: r.date,
    assignmentId: r.assignment_id,
    routineId: r.routine_id,
    durationMinutes: r.duration_minutes,
    rpe: r.rpe,
    condition: r.condition,
    status: r.status,
    notes: r.notes,
  };
}

export function sessionToRow(s: Session): SessionRow {
  return {
    id: s.id,
    client_id: s.clientId,
    date: s.date,
    assignment_id: s.assignmentId,
    routine_id: s.routineId,
    duration_minutes: s.durationMinutes,
    rpe: s.rpe,
    condition: s.condition,
    status: s.status,
    notes: s.notes,
  };
}

export function rowToSetLog(r: SetLogRow): SetLog {
  return {
    id: r.id,
    sessionId: r.session_id,
    position: r.position,
    exerciseId: r.exercise_id,
    modalityId: r.modality_id,
    setNumber: r.set_number,
    unilateralMode: r.unilateral_mode,
    side: r.side,
    reps: r.reps,
    weightLbs: r.weight_lbs,
    addedWeightLbs: r.added_weight_lbs,
    bandId: r.band_id,
    bandRole: r.band_role,
    durationSeconds: r.duration_seconds,
    distanceFeet: r.distance_feet,
    rir: r.rir,
    isWarmup: r.is_warmup,
    completed: r.completed,
    notes: r.notes,
  };
}

export function setLogToRow(s: SetLog): SetLogRow {
  return {
    id: s.id,
    session_id: s.sessionId,
    position: s.position,
    exercise_id: s.exerciseId,
    modality_id: s.modalityId,
    set_number: s.setNumber,
    unilateral_mode: s.unilateralMode,
    side: s.side,
    reps: s.reps,
    weight_lbs: s.weightLbs,
    added_weight_lbs: s.addedWeightLbs,
    band_id: s.bandId,
    band_role: s.bandRole,
    duration_seconds: s.durationSeconds,
    distance_feet: s.distanceFeet,
    rir: s.rir,
    is_warmup: s.isWarmup,
    completed: s.completed,
    notes: s.notes,
  };
}

export function rowToClient(r: ClientRow): Client {
  return {
    id: r.id,
    firstName: r.first_name,
    lastName: r.last_name,
    status: r.status,
    joinDate: r.join_date,
    dateOfBirth: r.date_of_birth,
    heightInches: r.height_inches,
    experienceLevel: r.experience_level,
    goal: r.goal,
    isTrainer: r.is_trainer,
    color: r.color,
    notes: r.notes,
  };
}

export function clientToRow(c: Client): ClientRow {
  return {
    id: c.id,
    first_name: c.firstName,
    last_name: c.lastName,
    status: c.status,
    join_date: c.joinDate,
    date_of_birth: c.dateOfBirth,
    height_inches: c.heightInches,
    experience_level: c.experienceLevel,
    goal: c.goal,
    is_trainer: c.isTrainer,
    color: c.color,
    notes: c.notes,
  };
}

export function rowToWeighIn(r: WeighInRow): WeighIn {
  return {
    id: r.id,
    clientId: r.client_id,
    date: r.date,
    bodyweightLbs: r.bodyweight_lbs,
  };
}

export function weighInToRow(w: WeighIn): WeighInRow {
  return {
    id: w.id,
    client_id: w.clientId,
    date: w.date,
    bodyweight_lbs: w.bodyweightLbs,
  };
}
