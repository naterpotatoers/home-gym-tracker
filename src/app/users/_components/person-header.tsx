import Link from "next/link";
import { PlayIcon } from "@/components/icons";
import { ColorDot } from "@/components/ui";
import type { ClientSummary } from "@/lib/queries";

/** "185.5" — weigh-ins log in half pounds, so keep one decimal when present. */
function weight(value: number): string {
  return String(Math.round(value * 10) / 10);
}

/**
 * The one person strip above the Clients tabs — the single home for the
 * at-a-glance counts (age, body weight, sessions, last trained) plus the
 * one primary action: resume their open session, else start one from the
 * launcher.
 */
export function PersonHeader({
  summary,
  resumeHref,
}: {
  summary: ClientSummary;
  /** The open session's href (resumeTargetForClient), or null to start fresh. */
  resumeHref: string | null;
}) {
  const { client, age, bodyweightLbs, bodyweightChangeLbs, sessionCount, lastSessionDate } =
    summary;
  const change =
    bodyweightChangeLbs === null
      ? null
      : `${bodyweightChangeLbs > 0 ? "+" : "−"}${weight(Math.abs(bodyweightChangeLbs))} since joining`;

  return (
    <div className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-border bg-surface px-4 py-3">
      <div className="flex min-w-0 items-center gap-2">
        <ColorDot color={client.color} size="lg" />
        <h2 className="truncate text-xl font-bold tracking-tight">{client.firstName}</h2>
        {client.isTrainer && (
          <span className="rounded bg-current/10 px-1.5 py-0.5 text-xs">trainer</span>
        )}
      </div>
      <dl className="flex flex-wrap items-baseline gap-x-4 gap-y-1 text-sm">
        <div className="flex gap-1">
          <dt className="sr-only">Age</dt>
          <dd className="font-mono">{age} yrs</dd>
        </div>
        <div className="flex gap-1">
          <dt className="sr-only">Body weight</dt>
          <dd>
            <span className="font-mono">
              {bodyweightLbs === null ? "— lb" : `${weight(bodyweightLbs)} lb`}
            </span>
            {change && <span className="ml-1 font-mono text-xs text-muted">({change})</span>}
          </dd>
        </div>
        <div className="flex gap-1">
          <dt className="text-muted">Sessions</dt>
          <dd className="font-mono">{sessionCount}</dd>
        </div>
        <div className="flex gap-1">
          <dt className="text-muted">Last trained</dt>
          <dd className="font-mono">{lastSessionDate ?? "—"}</dd>
        </div>
      </dl>
      <Link
        href={resumeHref ?? "/"}
        className="ml-auto inline-flex min-h-11 items-center gap-1.5 rounded-md border border-accent-warm/60 px-4 text-sm font-semibold text-accent-warm-text hover:bg-accent-warm/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
      >
        <PlayIcon size={16} />
        {resumeHref ? "Resume" : "Start workout"}
      </Link>
    </div>
  );
}
