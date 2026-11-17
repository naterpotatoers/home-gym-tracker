"use client";

import { useEffect, useEffectEvent, useRef, useState, useTransition } from "react";
import { ConfirmDeleteButton } from "@/components/confirm-delete-button";
import { PlusIcon } from "@/components/icons";
import { Button, ErrorText, Field, Input, Select } from "@/components/ui";
import { deleteRun, logRun, syncGarmin, syncStrava } from "@/lib/actions/runs";
import { plural } from "@/lib/format";
import { RUN_KIND_LABELS, RUN_KINDS, RUN_SOURCE_LABELS, type RunnerSummary } from "@/lib/running";
import { useFormAction } from "@/components/use-form-action";

/**
 * One person's running, on their Clients › Progress tab: this week's runs
 * and mileage, six weeks of weekly miles, recent runs, a Strava/Garmin sync
 * (that source's athlete only — auto on open, at most every 30 minutes) and
 * a manual log. Imported runs show their source and can't be deleted here. Styled as a page Section to sit among Lifts / Recent workouts.
 */
export function RunningSection({ runner, today }: { runner: RunnerSummary; today: string }) {
  const [logging, setLogging] = useState(false);
  const hasRuns = runner.recent.length > 0 || runner.weekly.some((w) => w.miles > 0);

  return (
    <section className="mt-10">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-2 border-b border-border pb-1">
        <h2 className="text-lg font-semibold">Running</h2>
        <div className="flex items-center gap-1">
          {runner.syncSources.map((source) =>
            source === "manual" ? null : <SourceSync key={source} source={source} />,
          )}
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setLogging((v) => !v)}
            aria-expanded={logging}
          >
            <PlusIcon size={14} /> Log run
          </Button>
        </div>
      </div>

      {logging && (
        <LogRunForm clientId={runner.clientId} today={today} onDone={() => setLogging(false)} />
      )}

      {!hasRuns ? (
        <p className="text-sm text-muted">No runs yet — log one.</p>
      ) : (
        <>
          <p className="text-sm">
            This week: <span className="font-mono">{plural(runner.weekRuns, "run")}</span> ·{" "}
            <span className="font-mono">{runner.weekMiles}</span>
          </p>
          <WeeklyMiles weeks={runner.weekly} />
          {runner.recent.length > 0 && (
            <ul className="mt-3 divide-y divide-border border-t border-border text-sm">
              {runner.recent.map((run) => (
                <li key={run.id} className="flex min-h-11 flex-wrap items-center gap-x-3 gap-y-0.5 py-1">
                  <span className="w-20 shrink-0 text-muted">{run.dayLabel}</span>
                  <span
                    className={`rounded px-1.5 py-0.5 text-xs ${
                      run.kind === "easy" ? "bg-current/10" : "bg-accent-soft text-accent-text"
                    }`}
                  >
                    {run.kindLabel}
                  </span>
                  <span className="font-mono">{run.miles}</span>
                  <span className="font-mono text-muted">{run.time}</span>
                  <span className="font-mono">{run.pace}</span>
                  {run.heartRate !== null && (
                    <span className="font-mono text-xs text-muted">♥ {run.heartRate}</span>
                  )}
                  {run.name && <span className="truncate text-xs text-muted">{run.name}</span>}
                  {run.source !== "manual" && (
                    <span className="text-[10px] uppercase tracking-wide text-muted">
                      {RUN_SOURCE_LABELS[run.source]}
                    </span>
                  )}
                  {run.source === "manual" && (
                    <ConfirmDeleteButton
                      action={deleteRun.bind(null, run.id)}
                      confirmText={`Delete the ${run.miles} run on ${run.dayLabel}?`}
                      ariaLabel={`Delete the ${run.miles} run on ${run.dayLabel}`}
                      className="ml-auto text-danger-text"
                    />
                  )}
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  );
}

/** Six weeks of mileage as labelled bars — the number is always printed, the
 *  bar is just the at-a-glance shape (a jump week stands out). */
function WeeklyMiles({ weeks }: { weeks: RunnerSummary["weekly"] }) {
  const max = Math.max(...weeks.map((w) => w.miles), 1);
  return (
    <div className="mt-2 grid grid-cols-6 items-end gap-1.5" aria-label="Weekly miles, last six weeks">
      {weeks.map((w, i) => (
        <div key={w.label} className="flex flex-col items-center gap-0.5">
          <span className="font-mono text-[11px]">{w.miles > 0 ? w.miles.toFixed(1) : "–"}</span>
          <div className="flex h-10 w-full items-end rounded-sm bg-track">
            <div
              className={`w-full rounded-sm ${i === weeks.length - 1 ? "bg-accent" : "bg-accent/50"}`}
              style={{ height: `${(w.miles / max) * 100}%` }}
            />
          </div>
          <span className="whitespace-nowrap text-[10px] text-muted">{w.label}</span>
        </div>
      ))}
    </div>
  );
}

const AUTO_SYNC_MS = 30 * 60 * 1000;
const SYNC = { strava: syncStrava, garmin: syncGarmin } as const;

/** Sync button; also syncs once on open when the last sync is >30 min old. */
function SourceSync({ source }: { source: keyof typeof SYNC }) {
  const syncKey = `${source}-last-sync`;
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const ran = useRef(false);

  const sync = (auto: boolean) =>
    start(async () => {
      const result = await SYNC[source]();
      if ("error" in result) {
        setMessage(result.error);
        return;
      }
      try {
        localStorage.setItem(syncKey, String(Date.now()));
      } catch {
        // storage blocked — auto-sync just runs again next time
      }
      if (!auto || result.imported > 0) {
        setMessage(result.imported > 0 ? `Imported ${plural(result.imported, "run")}.` : "Up to date.");
      }
    });

  // An Effect Event: reads the latest props without making them deps.
  const autoSync = useEffectEvent(() => {
    let last = 0;
    try {
      last = Number(localStorage.getItem(syncKey) ?? 0);
    } catch {
      // storage blocked — treat as never synced
    }
    if (Date.now() - last > AUTO_SYNC_MS) sync(true);
  });
  useEffect(() => {
    if (ran.current) return; // StrictMode double-mount
    ran.current = true;
    autoSync();
  }, []);

  return (
    <span className="flex items-center gap-2">
      {message && <span className="text-xs text-muted">{message}</span>}
      <Button size="sm" variant="ghost" disabled={pending} onClick={() => sync(false)}>
        {pending ? "Syncing…" : `Sync ${RUN_SOURCE_LABELS[source]}`}
      </Button>
    </span>
  );
}

function LogRunForm({
  clientId,
  today,
  onDone,
}: {
  clientId: string;
  today: string;
  onDone: () => void;
}) {
  const { error, pending, onSubmit } = useFormAction(logRun, { onSuccess: onDone });
  return (
    <form
      onSubmit={onSubmit}
      className="mb-3 grid grid-cols-2 gap-3 rounded-xl border border-border bg-surface p-3 sm:grid-cols-[11rem_6rem_7rem_9rem]"
    >
      <input type="hidden" name="clientId" value={clientId} />
      <Field label="Date">
        <Input type="date" name="date" defaultValue={today} max={today} required />
      </Field>
      <Field label="Miles">
        <Input name="miles" inputMode="decimal" placeholder="5.0" required />
      </Field>
      <Field label="Time">
        <Input name="time" inputMode="numeric" placeholder="46:40" required />
      </Field>
      <Field label="Type">
        <Select name="kind" defaultValue="easy">
          {RUN_KINDS.map((kind) => (
            <option key={kind} value={kind}>
              {RUN_KIND_LABELS[kind]}
            </option>
          ))}
        </Select>
      </Field>
      <div className="col-span-full flex items-center gap-3">
        <Button type="submit" variant="primary" disabled={pending}>
          {pending ? "Saving…" : "Save run"}
        </Button>
        <ErrorText>{error}</ErrorText>
      </div>
    </form>
  );
}
