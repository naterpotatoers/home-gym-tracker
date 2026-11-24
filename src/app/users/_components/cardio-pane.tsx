import { ConditioningSection } from "@/components/conditioning-section";
import { RunningSection } from "@/components/running-section";
import { conditioningSummaries, warmupSummary } from "@/lib/conditioning";
import type { GymData } from "@/lib/gym-data";
import { runLog, runnerSummary } from "@/lib/running";
import type { ClientId, RunSource } from "@/lib/types";
import { BIKE_WARMUP_RX } from "@/lib/warmup";

/**
 * Clients › Cardio: every run (synced from Strava/Garmin or logged by hand)
 * with twelve weeks of mileage, then Echo Bike pieces — finishers, then the
 * warm-ups as their own series. Kept apart from Lifts — cardio never enters
 * a strength number.
 */
export function CardioPane({
  data,
  client,
  today,
  runSyncSources,
}: {
  data: GymData;
  client: ClientId;
  today: string;
  /** Import sources syncing this person's runs (strava.ts/garmin.ts are
   *  server-only, so the page decides). */
  runSyncSources: RunSource[];
}) {
  const warmups = warmupSummary(data, client, BIKE_WARMUP_RX.exerciseId);
  const bike = [...conditioningSummaries(data, client), ...(warmups ? [warmups] : [])];
  return (
    <>
      {data.runsSource === "missing" ? (
        <p className="mt-6 rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-xs">
          Running isn&apos;t set up yet — run{" "}
          <code className="font-mono">supabase/migrations/2026-11-07-runs.sql</code> in the Supabase SQL editor,
          then reload.
        </p>
      ) : (
        <RunningSection
          runner={runnerSummary(data, client, today, runSyncSources)}
          log={runLog(data, client, today)}
          today={today}
        />
      )}
      {bike.length > 0 ? (
        <ConditioningSection summaries={bike} today={today} />
      ) : (
        <p className="mt-8 text-sm text-muted">
          No Echo Bike pieces yet. Logged bike warm-ups and finishers show up here.
        </p>
      )}
    </>
  );
}
