"use server";

import { redirect } from "next/navigation";
import { supabase } from "../db/client";
import { setLogToRow } from "../db/mappers";
import { loadGymData } from "../db/snapshot";
import { liveExtras, type LiveExtras } from "../live-session";
import { suggestedLoad } from "../queries";
import { conditioningTarget, EMPTY_TARGET } from "../conditioning";
import type { LoadPrefill } from "../set-templates";
import type { ClientId, ConditioningTarget, ExerciseId, ModalityId, SetLog } from "../types";
import type { FinishPayload } from "../validate";

import {
  finishProblem,
  isLocalPath,
  normalizeSetLog,
  setListProblem,
  setLogProblem,
} from "../validate";
import { assertExerciseIds, isMissingColumn } from "../db/guards";
import { revalidateAll, runMatched, rpc } from "./_helpers";

/** Set ids are slugs (clientSetId / newId) — anything else could break out of
 *  the quoted `not in` filter below. */
const SET_ID = /^[a-z0-9_-]+$/i;

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
  const { error } = await supabase.from("set_logs").update(fields).eq("id", id).eq("session_id", session_id);
  if (isMissingColumn(error) && "effort" in fields) {
    // Save the console numbers anyway — they must never ride on the effort
    // column existing — then say what's missing.
    const { effort: _effort, ...withoutEffort } = fields;
    void _effort;
    const retry = await supabase
      .from("set_logs")
      .update(withoutEffort)
      .eq("id", id)
      .eq("session_id", session_id);
    if (retry.error) throw new Error(`saving set: ${retry.error.message}`);
    throw new Error(
      "Saving effort needs a database update — run supabase/migrations/2026-11-23-bike-effort.sql in the Supabase SQL editor.",
    );
  }
  if (error) throw new Error(`saving set: ${error.message}`);
  // syncSetLogs needs no such check: before the migration, sync_set_logs'
  // jsonb_populate_recordset just ignores the unknown effort key.
  //
  // No revalidateAll() here or in syncSetLogs: the live runner/board holds
  // the set list client-side, and a revalidation makes Next re-render the
  // whole board inside this action's response (~1 s, ~250 KB). Actions are
  // dispatched one at a time per client, so with four people logging that
  // queue backed up — swaps hung and a refresh lost queued saves.
  // finishSession / discardSession revalidate when the session ends.
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
  const listProblem = setListProblem(sets);
  if (listProblem) throw new Error(listProblem);

  // One transaction: upsert the list, delete the session's other sets. It
  // also refuses ids owned by another session (the upsert matches on id
  // alone, so such an id would otherwise be moved into this one).
  await rpc("saving sets", "sync_set_logs", {
    p_session: sessionId,
    p_rows: sets.map((set) => setLogToRow(normalizeSetLog(set))),
  });
  // No revalidateAll() — see updateSetLog.
}

/** Re-derive a live session's stalls and finisher options from its saved
 *  set list — the runner calls this after a structural sync changed which
 *  variants it trains (set saves don't revalidate). Read-only. */
export async function getLiveExtras(sessionId: string): Promise<LiveExtras | null> {
  const data = await loadGymData();
  const session = data.sessionById.get(sessionId);
  return session ? liveExtras(data, session) : null;
}

/** Prefill for a variant the client is adding or swapping to mid-session.
 *  A conditioning variant gets the person's next target instead of a load —
 *  for `rx`'s interval scheme when it comes from a routine row. */
export async function getSuggestedLoad(
  clientId: ClientId,
  exerciseId: ExerciseId,
  modalityId: ModalityId,
  rx?: ConditioningTarget | null,
): Promise<LoadPrefill | null> {
  const data = await loadGymData();
  if (data.exerciseById.get(exerciseId)?.pattern === "conditioning") {
    const target = conditioningTarget(data, clientId, exerciseId, rx === undefined ? undefined : (rx ?? EMPTY_TARGET));
    return { weightLbs: null, addedWeightLbs: null, bandId: null, bandRole: null, target };
  }
  return suggestedLoad(data, clientId, exerciseId, modalityId);
}


/** Complete a session with the end-of-workout check-in. `redirectTo: null`
 *  stays put — the group board finishes people without navigating. */
export async function finishSession(
  sessionId: string,
  payload: FinishPayload,
  redirectTo: string | null = `/workout/session/${sessionId}`,
): Promise<void> {
  const problem = finishProblem(payload);
  if (problem) throw new Error(problem);
  if (redirectTo !== null && !isLocalPath(redirectTo)) throw new Error(`bad redirect ${redirectTo}`);
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
  // runMatched: discarding a session that already finished (another device
  // completed it) must say so, not silently do nothing.
  await runMatched(
    "discarding session",
    supabase.from("sessions").delete().eq("id", sessionId).eq("status", "planned").select("id"),
  );
  revalidateAll();
  redirect("/");
}
