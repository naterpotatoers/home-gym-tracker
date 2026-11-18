"use server";

import { redirect } from "next/navigation";
import { loadGymData } from "../db/snapshot";
import { localTodayIso } from "../periods";
import { plannedSessionFromRoutine } from "../planning";
import { type Plan, parsePlanValue } from "../launcher";
import type { ClientId, Session, SetLog } from "../types";
import { insertSessions, revalidateAll } from "./_helpers";
import { assertClientId } from "../db/guards";
import { parseBikeWarmup } from "../validate";

type GroupEntry = { clientId: ClientId; plan: Plan };

/**
 * Start a group workout: one planned session per person (or resume their
 * existing planned session), then land on the board with all of them.
 * Not exported — in a "use server" file every export is a live RPC endpoint,
 * and only `startGroupFromForm` should be one.
 */
async function startGroupSessions(
  entries: GroupEntry[],
  { bikeWarmup }: { bikeWarmup: boolean },
): Promise<void> {
  if (entries.length === 0) throw new Error("Pick at least one client.");
  const data = await loadGymData();

  const sessionIds: string[] = [];
  const newSessions: Session[] = [];
  const newSets: SetLog[] = [];

  for (const { clientId, plan } of entries) {
    if (plan.kind === "resume") {
      const session = data.sessionById.get(plan.sessionId);
      if (!session || session.status !== "planned") {
        throw new Error("Session to resume no longer exists.");
      }
      // A forged form must not pull someone else's session onto the board.
      if (session.clientId !== clientId) throw new Error("That session belongs to someone else.");
      sessionIds.push(session.id);
      continue;
    }
    const { session, sets } = plannedSessionFromRoutine(
      data,
      clientId,
      plan.routineId,
      plan.assignmentId,
      localTodayIso(),
      { bikeWarmup },
    );
    newSessions.push(session);
    newSets.push(...sets);
    sessionIds.push(session.id);
  }

  if (newSessions.length > 0) {
    await insertSessions("starting group", newSessions, newSets);
  }

  revalidateAll();
  // Solo detection: one person means no board — straight into the runner.
  if (sessionIds.length === 1) redirect(`/workout/session/${sessionIds[0]}`);
  redirect(`/workout/group/board?s=${sessionIds.join(",")}`);
}

/**
 * FormData shape from the launcher: `include_<clientId>` checkboxes,
 * `plan_<clientId>` selects holding a planValue (src/lib/launcher.ts), and
 * the shared `bike_warmup` checkbox (lifting starts open on the bike).
 */
export async function startGroupFromForm(formData: FormData): Promise<void> {
  const entries: GroupEntry[] = [];
  for (const key of formData.keys()) {
    if (!key.startsWith("include_")) continue;
    const clientId = key.slice("include_".length);
    await assertClientId(clientId);
    const value = String(formData.get(`plan_${clientId}`) ?? "");
    if (!value) continue;
    const plan = parsePlanValue(value);
    if (!plan) throw new Error(`bad plan ${value}`);
    entries.push({ clientId, plan });
  }
  await startGroupSessions(entries, { bikeWarmup: parseBikeWarmup(formData) });
}
