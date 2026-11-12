"use server";

import { supabase } from "../db/client";
import { runToRow, type RunRow } from "../db/mappers";
import type { FormResult } from "../form-result";
import { newId } from "../ids";
import { addDaysIso, localTodayIso, parseDuration, utcDay } from "../periods";
import { runFromActivity } from "../running";
import { fetchRunActivities, stravaConfig } from "../strava";
import type { RunKind } from "../types";
import { isIsoDate } from "../validate";
import { revalidateAll, run } from "./_helpers";
import { assertClientId } from "./clients";

const RUN_KINDS: readonly RunKind[] = ["easy", "long", "workout", "race"];
const MISSING_TABLE = "Runs need the database update — run supabase/migrations/2026-11-07-runs.sql in the Supabase SQL editor.";

/** Hand-logged run: miles + moving time (pace is derived, never stored). */
export async function logRun(formData: FormData): Promise<FormResult> {
  const clientId = String(formData.get("clientId") ?? "");
  await assertClientId(clientId);
  const date = String(formData.get("date") ?? "");
  const miles = Number(String(formData.get("miles") ?? "").trim());
  const durationSeconds = parseDuration(String(formData.get("time") ?? ""));
  const kind = String(formData.get("kind") ?? "easy") as RunKind;
  if (!isIsoDate(date)) return { error: "Pick a valid date." };
  if (!Number.isFinite(miles) || miles <= 0 || miles > 200) {
    return { error: "Distance must be between 0 and 200 miles." };
  }
  if (durationSeconds === null || durationSeconds > 48 * 3600) {
    return { error: "Time looks off — use 42:07 or 1:05:20." };
  }
  if (!RUN_KINDS.includes(kind)) return { error: "Pick a run type." };
  const { error } = await supabase.from("runs").insert(
    runToRow({
      id: newId("run"),
      clientId,
      date,
      distanceMiles: Math.round(miles * 100) / 100,
      durationSeconds,
      kind,
      avgHeartRate: null,
      elevationGainFt: null,
      name: "",
      source: "manual",
      externalId: null,
      notes: String(formData.get("notes") ?? "").trim(),
    }),
  );
  if (error?.code === "PGRST205") return { error: MISSING_TABLE };
  if (error) throw new Error(`logging run: ${error.message}`);
  revalidateAll();
  return null;
}

export async function deleteRun(id: string): Promise<void> {
  await run("deleting run", supabase.from("runs").delete().eq("id", id));
  revalidateAll();
}

export type StravaSyncResult = { imported: number; updated: number } | { error: string };

/**
 * Pull runs from Strava for the configured athlete. Looks back from a few
 * days before the newest imported run (catches late uploads and edits made
 * on Strava — renamed, re-tagged as a long run) or 90 days on first sync.
 * Idempotent: rows key on external_id, so re-syncing updates, never duplicates.
 */
export async function syncStrava(): Promise<StravaSyncResult> {
  const config = stravaConfig();
  if (!config) return { error: "Strava isn't set up — see README › Strava." };
  await assertClientId(config.athlete);

  const latest = await supabase
    .from("runs")
    .select("date")
    .eq("client_id", config.athlete)
    .eq("source", "strava")
    .order("date", { ascending: false })
    .limit(1);
  if (latest.error?.code === "PGRST205") return { error: MISSING_TABLE };
  if (latest.error) throw new Error(`syncing Strava: ${latest.error.message}`);
  const from = latest.data[0]?.date
    ? addDaysIso(latest.data[0].date as string, -3)
    : addDaysIso(localTodayIso(), -90);
  // Day 0 of the UTC calendar → epoch seconds; a day of slack covers zones.
  const afterEpoch = (utcDay(from) - 1) * 86_400;

  let activities;
  try {
    activities = await fetchRunActivities(config, afterEpoch);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Strava sync failed." };
  }
  if (activities.length === 0) return { imported: 0, updated: 0 };

  const incoming = activities.map((a) => runFromActivity(a, config.athlete));
  const existing = await run(
    "syncing Strava",
    supabase
      .from("runs")
      .select("id, external_id")
      .in(
        "external_id",
        incoming.map((r) => r.externalId!),
      ),
  );
  const idByExternal = new Map(
    (existing as { id: string; external_id: string }[]).map((r) => [r.external_id, r.id]),
  );

  const fresh = incoming.filter((r) => !idByExternal.has(r.externalId!));
  if (fresh.length > 0) {
    await run(
      "importing Strava runs",
      supabase.from("runs").insert(fresh.map((r) => runToRow({ ...r, id: newId("run") }))),
    );
  }
  // Already imported: refresh what Strava owns, keep the app-side notes.
  const known = incoming.filter((r) => idByExternal.has(r.externalId!));
  for (const r of known) {
    const fields: Partial<RunRow> = runToRow({ ...r, id: idByExternal.get(r.externalId!)! });
    delete fields.notes;
    await run("updating Strava run", supabase.from("runs").update(fields).eq("id", fields.id!));
  }
  revalidateAll();
  return { imported: fresh.length, updated: known.length };
}
