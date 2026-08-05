"use server";

import { redirect } from "next/navigation";
import { supabase } from "../db/client";
import { sessionToRow, setLogToRow } from "../db/mappers";
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
import {
  isExerciseId,
  isModalityId,
  isSessionCondition,
} from "../validate";
import { revalidateAll, run } from "./_helpers";
import { assertClientId } from "./clients";

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
  const { session, sets } = plannedSessionFromRoutine(
    data,
    clientId,
    routineId,
    assignmentId,
    localTodayIso(),
  );

  await run("starting session", supabase.from("sessions").insert(sessionToRow(session)));
  await run("starting session", supabase.from("set_logs").insert(sets.map(setLogToRow)));

  revalidateAll();
  redirect(`/workout/session/${session.id}`);
}

/** Single-row upsert: the per-set edits (weight, reps, RIR, done, warmup). */
export async function updateSetLog(set: SetLog): Promise<void> {
  if (!isExerciseId(set.exerciseId)) throw new Error(`bad exercise id ${set.exerciseId}`);
  if (!isModalityId(set.modalityId)) throw new Error(`bad modality id ${set.modalityId}`);
  await run("saving set", supabase.from("set_logs").upsert(setLogToRow(set)));
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
  for (const set of sets) {
    if (set.sessionId !== sessionId) throw new Error("set belongs to another session");
    if (!isExerciseId(set.exerciseId)) throw new Error(`bad exercise id ${set.exerciseId}`);
    if (!isModalityId(set.modalityId)) throw new Error(`bad modality id ${set.modalityId}`);
  }

  await run("saving sets", supabase.from("set_logs").upsert(sets.map(setLogToRow)));

  const keep = sets.map((s) => s.id);
  let deletion = supabase.from("set_logs").delete().eq("session_id", sessionId);
  if (keep.length > 0) {
    deletion = deletion.not("id", "in", `(${keep.map((id) => `"${id}"`).join(",")})`);
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
  if (payload.rpe !== null && (payload.rpe < 1 || payload.rpe > 10)) {
    throw new Error(`bad rpe ${payload.rpe}`);
  }
  if (payload.condition !== null && !isSessionCondition(payload.condition)) {
    throw new Error(`bad condition ${payload.condition}`);
  }
  await run(
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
      .eq("id", sessionId),
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
  redirect("/workout");
}
