import Link from "next/link";
import { ConfirmDeleteButton } from "@/components/confirm-delete-button";
import { PlusIcon, SaveIcon } from "@/components/icons";
import { Button, Card, ColorDot, Field, Input, Note, PageShell, Stat } from "@/components/ui";
import { createClient, deleteClient, updateClient } from "@/lib/actions/clients";
import { createWeighIn, deleteWeighIn } from "@/lib/actions/weigh-ins";
import { loadGymData } from "@/lib/db/snapshot";
import { localTodayIso } from "@/lib/periods";
import { parseProgressParams } from "@/lib/progress-url";
import { clientSummaries } from "@/lib/queries";
import { weighInHistory } from "@/lib/weigh-ins";
import { Overview } from "./_components/overview";
import { PersonList, ViewTabs } from "./_components/person-list";
import { ProfileFields } from "./_components/profile-fields";

/**
 * The Clients hub: everyone who trains here, one selected at a time. Three
 * panes per person — Metrics (stats, bodyweight, lifts), Tracking (weigh-in
 * entry now; calories/macros later), Profile (slow-changing fields) — plus
 * an add-person pane reached from the sidebar. Selection and view live in
 * the URL via progressHref, so every state is linkable.
 */
export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const raw = await searchParams;
  const data = await loadGymData();
  const params = parseProgressParams(raw, data);
  const summaries = clientSummaries(data);
  const today = localTodayIso();

  const migrationNote = data.clientsSource === "seed" && (
    <p className="mb-6 rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-xs">
      The clients table doesn&apos;t exist yet — run{" "}
      <code className="font-mono">supabase/schema.sql</code> in the Supabase
      SQL editor. Until then this page is read-only.
    </p>
  );

  const addPersonCard = (
    <Card className="mt-4">
      <h2 className="mb-3 text-lg font-semibold">Add a person</h2>
      <form action={createClient} className="space-y-3">
        <ProfileFields />
        <Button type="submit" variant="primary" size="sm">
          <PlusIcon size={16} /> Add person
        </Button>
      </form>
    </Card>
  );

  const person = data.clientById.get(params.client);
  if (!person) {
    // Empty roster: this page IS where people get added, so go straight there.
    return (
      <PageShell>
        {migrationNote}
        <h1 className="text-3xl font-bold tracking-tight">Clients</h1>
        {addPersonCard}
      </PageShell>
    );
  }

  const summary = summaries.find((s) => s.client.id === person.id);
  const history = weighInHistory(data, person.id);

  return (
    <PageShell>
      {migrationNote}
      <h1 className="text-3xl font-bold tracking-tight">Clients</h1>

      <div className="mt-6 space-y-4 lg:grid lg:grid-cols-[16rem_1fr] lg:gap-8 lg:space-y-0">
        <aside>
          <PersonList summaries={summaries} params={params} />
        </aside>

        <main className="min-w-0">
          <ViewTabs params={params} />

          {params.view === "add" ? (
            addPersonCard
          ) : params.view === "profile" ? (
            <Card className="mt-4">
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <ColorDot color={person.color} size="lg" />
                <h2 className="text-lg font-semibold">{person.firstName}</h2>
                {person.isTrainer && (
                  <span className="rounded bg-current/10 px-1.5 py-0.5 text-xs">trainer</span>
                )}
                {summary && (
                  <span className="ml-auto text-xs text-muted">
                    {summary.age} yrs · {summary.sessionCount} sessions
                    {summary.lastSessionDate && ` · last ${summary.lastSessionDate}`}
                  </span>
                )}
              </div>
              <form action={updateClient.bind(null, person.id)} className="space-y-3">
                <ProfileFields client={person} />
                <div className="flex items-center gap-2">
                  <Button type="submit" variant="primary" size="sm">
                    <SaveIcon size={16} /> Save {person.firstName}
                  </Button>
                  <ConfirmDeleteButton
                    action={deleteClient.bind(null, person.id)}
                    confirmText={`Delete ${person.firstName}? Only possible while they have no sessions, assignments, or weigh-ins.`}
                    ariaLabel={`Delete ${person.firstName}`}
                    className="ml-auto text-danger-text"
                  />
                </div>
              </form>
            </Card>
          ) : params.view === "tracking" ? (
            <Card className="mt-4">
              <h2 className="mb-3 text-lg font-semibold">
                {person.firstName} — weigh-ins
              </h2>
              <form
                action={createWeighIn.bind(null, person.id)}
                className="flex flex-wrap items-end gap-3"
              >
                <Field label="Weigh-in date">
                  <Input type="date" name="date" required defaultValue={today} />
                </Field>
                <Field label="Weight (lb)">
                  <Input
                    type="number"
                    name="bodyweightLbs"
                    required
                    min={50}
                    max={1000}
                    step={0.5}
                    align="right"
                    placeholder="185"
                    className="w-28"
                  />
                </Field>
                <Button type="submit" variant="primary" size="sm">
                  <PlusIcon size={16} /> Log weigh-in
                </Button>
              </form>

              {history.length > 0 && (
                <ul className="mt-4 divide-y divide-border border-t border-border text-sm">
                  {history
                    .slice(-12)
                    .reverse()
                    .map((w) => (
                      <li key={w.id} className="flex items-center gap-3 py-1">
                        <span className="font-mono text-xs text-muted">{w.date}</span>
                        <span className="font-mono">{w.bodyweightLbs} lb</span>
                        <ConfirmDeleteButton
                          action={deleteWeighIn.bind(null, w.id)}
                          confirmText={`Delete the ${w.date} (${w.bodyweightLbs} lb) weigh-in?`}
                          ariaLabel={`Delete weigh-in: ${w.date} (${w.bodyweightLbs} lb)`}
                          title="Delete weigh-in"
                        />
                      </li>
                    ))}
                </ul>
              )}
              <Note>
                Weight lives only on this tab. Calorie &amp; macro tracking
                will land here one day.
              </Note>
            </Card>
          ) : (
            <>
              <p className="mt-3 text-sm text-muted">
                Tap a workout or a lift below to expand it in place. Muscle
                heat over time lives in the{" "}
                <Link
                  href={`/metrics/heatmap${
                    params.client !== params.defaultClient ? `?client=${params.client}` : ""
                  }`}
                  className="text-accent-text underline underline-offset-2"
                >
                  heat map
                </Link>
                .
              </p>

              {summary && (
                <dl className="mt-4 flex flex-wrap gap-x-8 gap-y-2">
                  <Stat label="Sessions" value={String(summary.sessionCount)} />
                  <Stat label="Last trained" value={summary.lastSessionDate ?? "—"} />
                </dl>
              )}

              <Overview
                data={data}
                client={person.id}
                params={params}
                personName={person.firstName}
              />
            </>
          )}
        </main>
      </div>
    </PageShell>
  );
}
