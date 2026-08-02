"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { supabase } from "../db/client";
import { sessionToRow, setLogToRow } from "../db/mappers";
import { loadGymData } from "../db/snapshot";
import { localToday, plannedSessionFromRoutine } from "../planning";
import type { ClientId, Session, SetLog } from "../types";
import { isClientId } from "../validate";

export type GroupEntry =
  | { clientId: ClientId; routineId: string; assignmentId: string | null }
  | { resumeSessionId: string };

/**
 * Start a group workout: one planned session per person (or resume their
 * existing planned session), then land on the board with all of them.
 */
export async function startGroupSessions(entries: GroupEntry[]): Promise<void> {
  if (entries.length === 0) throw new Error("Pick at least one person.");
  const data = await loadGymData();

  const sessionIds: string[] = [];
  const newSessions: Session[] = [];
  const newSets: SetLog[] = [];

  for (const entry of entries) {
    if ("resumeSessionId" in entry) {
      const session = data.sessionById.get(entry.resumeSessionId);
      if (!session || session.status !== "planned") {
        throw new Error("Session to resume no longer exists.");
      }
      sessionIds.push(session.id);
      continue;
    }
    if (!isClientId(entry.clientId)) throw new Error(`bad client id ${entry.clientId}`);
    const { session, sets } = plannedSessionFromRoutine(
      data,
      entry.clientId,
      entry.routineId,
      entry.assignmentId,
      localToday(),
    );
    newSessions.push(session);
    newSets.push(...sets);
    sessionIds.push(session.id);
  }

  if (newSessions.length > 0) {
    const { error: sessionError } = await supabase
      .from("sessions")
      .insert(newSessions.map(sessionToRow));
    if (sessionError) throw new Error(`starting group: ${sessionError.message}`);
    const { error: setsError } = await supabase
      .from("set_logs")
      .insert(newSets.map(setLogToRow));
    if (setsError) throw new Error(`starting group: ${setsError.message}`);
  }

  revalidatePath("/", "layout");
  redirect(`/workout/group/board?s=${sessionIds.join(",")}`);
}

/**
 * FormData shape from the setup page: `include_<clientId>` checkboxes and
 * `plan_<clientId>` selects whose value is `resume:<sessionId>` or
 * `<routineId>|<assignmentId-or-empty>`.
 */
export async function startGroupFromForm(formData: FormData): Promise<void> {
  const entries: GroupEntry[] = [];
  for (const key of formData.keys()) {
    if (!key.startsWith("include_")) continue;
    const clientId = key.slice("include_".length);
    if (!isClientId(clientId)) throw new Error(`bad client id ${clientId}`);
    const plan = String(formData.get(`plan_${clientId}`) ?? "");
    if (!plan) continue;
    if (plan.startsWith("resume:")) {
      entries.push({ resumeSessionId: plan.slice("resume:".length) });
    } else {
      const [routineId, assignmentId] = plan.split("|");
      entries.push({ clientId, routineId, assignmentId: assignmentId || null });
    }
  }
  await startGroupSessions(entries);
}
