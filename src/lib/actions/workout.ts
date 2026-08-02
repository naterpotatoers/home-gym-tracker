"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { supabase } from "../db/client";
import { sessionToRow, setLogToRow } from "../db/mappers";
import { loadGymData } from "../db/snapshot";
import { localToday, plannedSessionFromRoutine } from "../planning";
import { suggestedLoad } from "../queries";
import type {
  ClientId,
  ExerciseId,
  ModalityId,
  SessionCondition,
  SetLog,
} from "../types";
import {
  isClientId,
  isExerciseId,
  isModalityId,
  isSessionCondition,
} from "../validate";

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
  if (!isClientId(clientId)) throw new Error(`bad client id ${clientId}`);
  const data = await loadGymData();
  const { session, sets } = plannedSessionFromRoutine(
    data,
    clientId,
    routineId,
    assignmentId,
    localToday(),
  );

  const { error: sessionError } = await supabase
    .from("sessions")
    .insert(sessionToRow(session));
  if (sessionError) throw new Error(`starting session: ${sessionError.message}`);
  const { error: setsError } = await supabase
    .from("set_logs")
    .insert(sets.map(setLogToRow));
  if (setsError) throw new Error(`starting session: ${setsError.message}`);

  revalidatePath("/", "layout");
  redirect(`/workout/session/${session.id}`);
}

/** Single-row upsert: the per-set edits (weight, reps, RIR, done, warmup). */
export async function updateSetLog(set: SetLog): Promise<void> {
  if (!isExerciseId(set.exerciseId)) throw new Error(`bad exercise id ${set.exerciseId}`);
  if (!isModalityId(set.modalityId)) throw new Error(`bad modality id ${set.modalityId}`);
  const { error } = await supabase.from("set_logs").upsert(setLogToRow(set));
  if (error) throw new Error(`saving set: ${error.message}`);
  revalidatePath("/", "layout");
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

  const { error: upsertError } = await supabase
    .from("set_logs")
    .upsert(sets.map(setLogToRow));
  if (upsertError) throw new Error(`saving sets: ${upsertError.message}`);

  const keep = sets.map((s) => s.id);
  let deletion = supabase.from("set_logs").delete().eq("session_id", sessionId);
  if (keep.length > 0) {
    deletion = deletion.not("id", "in", `(${keep.map((id) => `"${id}"`).join(",")})`);
  }
  const { error: deleteError } = await deletion;
  if (deleteError) throw new Error(`saving sets: ${deleteError.message}`);

  revalidatePath("/", "layout");
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
  const { error } = await supabase
    .from("sessions")
    .update({
      status: "completed",
      duration_minutes: payload.durationMinutes,
      notes: payload.notes,
      rpe: payload.rpe,
      condition: payload.condition,
    })
    .eq("id", sessionId);
  if (error) throw new Error(`finishing session: ${error.message}`);
  revalidatePath("/", "layout");
  if (redirectTo !== null) redirect(redirectTo);
}

/** Delete a planned session that never happened. Cascades its set logs. */
export async function discardSession(sessionId: string): Promise<void> {
  const { error } = await supabase
    .from("sessions")
    .delete()
    .eq("id", sessionId)
    .eq("status", "planned");
  if (error) throw new Error(`discarding session: ${error.message}`);
  revalidatePath("/", "layout");
  redirect("/workout");
}
