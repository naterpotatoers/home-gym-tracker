"use server";

import { redirect } from "next/navigation";
import { supabase } from "../db/client";
import { setLogToRow } from "../db/mappers";
import { loadGymData } from "../db/snapshot";
import { localTodayIso } from "../periods";
import { plannedSessionFromRoutine } from "../planning";
import { suggestedLoad } from "../queries";
import type {
  ClientId,
  ExerciseId,
  ModalityId,
  SessionCondition,
  SetLog,
} from "../types";

/** Set ids are slugs (clientSetId / newId) — anything else could break out of
 *  the quoted `not in` filter below. */
const SET_ID = /^[a-z0-9_-]+$/i;
import {
  isSessionCondition,
  normalizeSetLog,
  setLogProblem,
} from "../validate";
import { insertSessions, revalidateAll, run, runMatched } from "./_helpers";
import { assertClientId } from "./clients";
import { assertExerciseIds } from "./exercises";

/**
 * Start a session from a routine: a planned Session plus one editable SetLog
 * per prescribed set, prefilled with the client's most recent load for each
 * variant. The runner then edits these rows set-by-set.
 */
export async function startSession(
  clientId: ClientId,
  routineId: string,
  assignmentId: string | null,
): Promise<void> {
  await assertClientId(clientId);
  const data = await loadGymData();

  // A planned session of this routine already exists — a stale Play button
  // (cached page, double tap) must land back in it, not strand it behind a
  // fresh duplicate. Starting a DIFFERENT routine stays an explicit choice.
  const existing = data.sessions.find(
    (s) => s.clientId === clientId && s.routineId === routineId && s.status === "planned",
  );
  if (existing) redirect(`/workout/session/${existing.id}`);

  const { session, sets } = plannedSessionFromRoutine(
    data,
    clientId,
    routineId,
    assignmentId,
    localTodayIso(),
  );

  await insertSessions("starting session", [session], sets);

  revalidateAll();
  redirect(`/workout/session/${session.id}`);
}

function assertSetLog(set: SetLog): void {
  const problem = setLogProblem(set);
  if (problem) throw new Error(problem);
}

/** Single-row edit: the per-set edits (weight, reps, RIR, done, warmup).
 *  An UPDATE, never an upsert — a request that lands after a structural sync
 *  deleted the row must not resurrect it, and the row can't move sessions. */
export async function updateSetLog(set: SetLog): Promise<void> {
  await assertExerciseIds([set.exerciseId]);
  assertSetLog(set);
  const { id, session_id, ...fields } = setLogToRow(normalizeSetLog(set));
  const { error } = await supabase
    .from("set_logs")
    .update(fields)
    .eq("id", id)
    .eq("session_id", session_id);
  if (error) throw new Error(`saving set: ${error.message}`);
  revalidateAll();
}

/**
 * Structural sync: the runner treats a session's set list as one document.
 * Adding/removing sets, swapping an exercise, or renumbering positions sends
 * the whole list; rows missing from it are deleted.
 */
export async function syncSetLogs(
  sessionId: string,
  sets: readonly SetLog[],
): Promise<void> {
  await assertExerciseIds(sets.map((set) => set.exerciseId));
  for (const set of sets) {
    if (set.sessionId !== sessionId) throw new Error("set belongs to another session");
    if (!SET_ID.test(set.id)) throw new Error(`bad set id ${set.id}`);
    assertSetLog(set);
  }

  // The upsert matches on id alone, so an id owned by another session would
  // be moved into this one. Refuse instead.
  const ids = sets.map((s) => s.id);
  if (ids.length > 0) {
    const owned = await run(
      "saving sets",
      supabase.from("set_logs").select("id").in("id", ids).neq("session_id", sessionId),
    );
    if (owned && owned.length > 0) throw new Error("set belongs to another session");
  }

  await run(
    "saving sets",
    supabase.from("set_logs").upsert(sets.map((set) => setLogToRow(normalizeSetLog(set)))),
  );

  let deletion = supabase.from("set_logs").delete().eq("session_id", sessionId);
  if (ids.length > 0) {
    deletion = deletion.not("id", "in", `(${ids.map((id) => `"${id}"`).join(",")})`);
  }
  await run("saving sets", deletion);

  revalidateAll();
}

/** Prefill for a variant the client is swapping to mid-session. */
export async function getSuggestedLoad(
  clientId: ClientId,
  exerciseId: ExerciseId,
  modalityId: ModalityId,
): Promise<Pick<SetLog, "weightLbs" | "addedWeightLbs" | "bandId" | "bandRole"> | null> {
  const data = await loadGymData();
  return suggestedLoad(data, clientId, exerciseId, modalityId);
}

export type FinishPayload = {
  durationMinutes: number | null;
  notes: string;
  /** Session RPE 1-10, optional. */
  rpe: number | null;
  condition: SessionCondition | null;
};

/** Complete a session with the end-of-workout check-in. `redirectTo: null`
 *  stays put — the group board finishes people without navigating. */
export async function finishSession(
  sessionId: string,
  payload: FinishPayload,
  redirectTo: string | null = `/workout/session/${sessionId}`,
): Promise<void> {
  if (
    payload.rpe !== null &&
    (!Number.isInteger(payload.rpe) || payload.rpe < 1 || payload.rpe > 10)
  ) {
    throw new Error(`bad rpe ${payload.rpe}`);
  }
  if (payload.condition !== null && !isSessionCondition(payload.condition)) {
    throw new Error(`bad condition ${payload.condition}`);
  }
  if (
    payload.durationMinutes !== null &&
    (!Number.isInteger(payload.durationMinutes) ||
      payload.durationMinutes < 0 ||
      payload.durationMinutes > 24 * 60)
  ) {
    throw new Error(`bad duration ${payload.durationMinutes}`);
  }
  await runMatched(
    "finishing session",
    supabase
      .from("sessions")
      .update({
        status: "completed",
        duration_minutes: payload.durationMinutes,
        notes: payload.notes,
        rpe: payload.rpe,
        condition: payload.condition,
      })
      .eq("id", sessionId)
      .select("id"),
  );
  revalidateAll();
  if (redirectTo !== null) redirect(redirectTo);
}

/** Delete a planned session that never happened. Cascades its set logs. */
export async function discardSession(sessionId: string): Promise<void> {
  await run(
    "discarding session",
    supabase.from("sessions").delete().eq("id", sessionId).eq("status", "planned"),
  );
  revalidateAll();
  redirect("/");
}
