"use server";

import { supabase } from "../db/client";
import { assertClientId, isMissingTable } from "../db/guards";
import { rowToRun, runToRow, type RunRow } from "../db/mappers";
import { errorMessage } from "../format";
import type { FormResult } from "../form-result";
import { fetchActivities, garminConfig } from "../garmin";
import { newId } from "../ids";
import { addDaysIso, localTodayIso, utcDay } from "../periods";
import { isGarminRun, planRunSync, runFromActivity, runFromGarmin } from "../running";
import { fetchRunActivities, stravaConfig } from "../strava";
import type { Run } from "../types";
import { parseRunForm } from "../validate";
import { revalidateAll, run, runMatched } from "./_helpers";

const MISSING_TABLE =
  "Runs need the database update — run supabase/migrations/2026-11-07-runs.sql in the Supabase SQL editor.";

/** Hand-logged run: miles + moving time (pace is derived, never stored). */
export async function logRun(formData: FormData): Promise<FormResult> {
  const clientId = String(formData.get("clientId") ?? "");
  await assertClientId(clientId);
  const form = parseRunForm(formData);
  if ("error" in form) return form;
  const { error } = await supabase.from("runs").insert(
    runToRow({
      id: newId("run"),
      clientId,
      ...form,
      avgHeartRate: null,
      elevationGainFt: null,
      name: "",
      source: "manual",
      externalId: null,
    }),
  );
  if (isMissingTable(error)) return { error: MISSING_TABLE };
  if (error) throw new Error(`logging run: ${error.message}`);
  revalidateAll();
  return null;
}

/** Only hand-logged runs delete — an import would just come back on the
 *  next sync (delete it in Strava/Garmin instead). */
export async function deleteRun(id: string): Promise<void> {
  await runMatched(
    "deleting run",
    supabase.from("runs").delete().eq("id", id).eq("source", "manual").select("id"),
  );
  revalidateAll();
}

export type RunSyncResult =
  | { imported: number; updated: number; skipped: number }
  | { error: string };

/**
 * Pull one source's runs for its athlete. Looks back from a few days before
 * the newest run imported from this source (catches late uploads and edits —
 * renamed, re-tagged) or 90 days on first sync. Idempotent: rows key on
 * external_id, so re-syncing updates, never duplicates; a run already
 * logged from another source (a Garmin watch that also pushes to Strava) is
 * skipped. Refreshes keep the app-side notes and run type.
 */
async function syncRunSource(
  source: "strava" | "garmin",
  athlete: string,
  fetchSince: (fromIso: string) => Promise<Omit<Run, "id">[]>,
): Promise<RunSyncResult> {
  await assertClientId(athlete);
  const label = `syncing ${source}`;

  const latest = await supabase
    .from("runs")
    .select("date")
    .eq("client_id", athlete)
    .eq("source", source)
    .order("date", { ascending: false })
    .limit(1);
  if (isMissingTable(latest.error)) return { error: MISSING_TABLE };
  if (latest.error) throw new Error(`${label}: ${latest.error.message}`);
  const from = latest.data[0]?.date
    ? addDaysIso(latest.data[0].date as string, -3)
    : addDaysIso(localTodayIso(), -90);

  let incoming: Omit<Run, "id">[];
  try {
    incoming = await fetchSince(from);
  } catch (e) {
    return { error: errorMessage(e, `${source} sync failed.`) };
  }
  if (incoming.length === 0) return { imported: 0, updated: 0, skipped: 0 };

  const [existing, nearby] = await Promise.all([
    run(
      label,
      supabase
        .from("runs")
        .select("id, external_id")
        .in("external_id", incoming.map((r) => r.externalId!)),
    ),
    run(
      label,
      supabase
        .from("runs")
        .select("*")
        .eq("client_id", athlete)
        .neq("source", source)
        .gte("date", addDaysIso(from, -1)),
    ),
  ]);
  const idByExternal = new Map(
    (existing as { id: string; external_id: string }[]).map((r) => [r.external_id, r.id]),
  );
  const plan = planRunSync(incoming, idByExternal, (nearby as RunRow[]).map(rowToRun));

  if (plan.fresh.length > 0) {
    await run(
      label,
      supabase.from("runs").insert(plan.fresh.map((r) => runToRow({ ...r, id: newId("run") }))),
    );
  }
  for (const { id, run: r } of plan.known) {
    const fields: Partial<RunRow> = runToRow({ ...r, id });
    delete fields.notes;
    // Garmin has no run-type tag — keep whatever kind was set in the app.
    if (source === "garmin") delete fields.kind;
    await run(label, supabase.from("runs").update(fields).eq("id", id));
  }
  revalidateAll();
  return { imported: plan.fresh.length, updated: plan.known.length, skipped: plan.duplicates };
}

export async function syncStrava(): Promise<RunSyncResult> {
  const config = stravaConfig();
  if (!config) return { error: "Strava isn't set up — see README › Strava." };
  return syncRunSource("strava", config.athlete, async (from) => {
    // Day 0 of the UTC calendar → epoch seconds; a day of slack covers zones.
    const activities = await fetchRunActivities(config, (utcDay(from) - 1) * 86_400);
    return activities.map((a) => runFromActivity(a, config.athlete));
  });
}

export async function syncGarmin(): Promise<RunSyncResult> {
  const config = garminConfig();
  if (!config) return { error: "Garmin isn't set up — see README › Garmin." };
  return syncRunSource("garmin", config.athlete, async (from) => {
    const activities = await fetchActivities(config, addDaysIso(from, -1), localTodayIso());
    return activities.filter(isGarminRun).map((a) => runFromGarmin(a, config.athlete));
  });
}
