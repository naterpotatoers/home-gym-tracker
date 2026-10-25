import { ConfirmDeleteButton } from "@/components/confirm-delete-button";
import { Card, Note, PageShell } from "@/components/ui";
import { createClient, deleteClient, updateClient } from "@/lib/actions/clients";
import { createWeighIn, deleteWeighIn } from "@/lib/actions/weigh-ins";
import { loadGymData } from "@/lib/db/snapshot";
import { recentFoods } from "@/lib/nutrition";
import { localTodayIso } from "@/lib/periods";
import { parseProgressParams } from "@/lib/progress-url";
import { clientSummaries, resumeTargetForClient } from "@/lib/queries";
import { weighInHistory } from "@/lib/weigh-ins";
import { ProfileForm } from "./_components/forms";
import { LogPane } from "./_components/log-pane";
import { Overview } from "./_components/overview";
import { PersonHeader } from "./_components/person-header";
import { PersonList, ViewTabs } from "./_components/person-list";

/**
 * The Clients hub: everyone who trains here, one selected at a time. A person
 * header strip (counts + Start/Resume) sits above three panes — Progress
 * (lifts, recent workouts, muscle work), Log (body weight + food for one
 * picked day), Profile (slow-changing fields) — plus an add-person pane
 * reached from the sidebar. Selection and view live in the URL via
 * progressHref, so every state is linkable.
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
    <Card>
      <h2 className="mb-3 text-lg font-semibold">Add a client</h2>
      <ProfileForm action={createClient} submitLabel="Add client" />
    </Card>
  );

  const person = data.clientById.get(params.client);
  if (!person) {
    // Empty roster: this page IS where people get added, so go straight there.
    return (
      <PageShell>
        {migrationNote}
        <h1 className="mb-4 text-3xl font-bold tracking-tight">Clients</h1>
        {addPersonCard}
      </PageShell>
    );
  }

  const summary = summaries.find((s) => s.client.id === person.id);
  const history = weighInHistory(data, person.id);
  const resume = resumeTargetForClient(data, person.id);

  return (
    <PageShell>
      {migrationNote}
      <h1 className="text-3xl font-bold tracking-tight">Clients</h1>

      <div className="mt-6 space-y-4 xl:grid xl:grid-cols-[14rem_1fr] xl:gap-8 xl:space-y-0">
        <aside>
          <PersonList summaries={summaries} params={params} />
        </aside>

        <div className="min-w-0">
          {params.view === "add" ? (
            addPersonCard
          ) : (
            <>
              {summary && <PersonHeader summary={summary} resumeHref={resume?.href ?? null} />}
              <ViewTabs params={params} />

              {params.view === "profile" ? (
                <Card className="mt-4">
                  <ProfileForm
                    key={person.id}
                    action={updateClient.bind(null, person.id)}
                    client={person}
                    submitLabel={`Save ${person.firstName}`}
                    extra={
                      <ConfirmDeleteButton
                        action={deleteClient.bind(null, person.id)}
                        confirmText={`Delete ${person.firstName}? Only possible while they have no sessions, assignments, or body weight entries.`}
                        ariaLabel={`Delete ${person.firstName}`}
                        className="ml-auto text-danger-text"
                      />
                    }
                  />
                </Card>
              ) : params.view === "tracking" ? (
                <LogPane
                  key={person.id}
                  clientId={person.id}
                  today={today}
                  weighInAction={createWeighIn.bind(null, person.id)}
                  weighIns={history.map((w) => ({
                    date: w.date,
                    bodyweightLbs: w.bodyweightLbs,
                  }))}
                  nutrition={
                    data.nutritionSource === "missing"
                      ? null
                      : {
                          foods: [...data.foods],
                          recents: recentFoods(data, person.id),
                          logs: data.foodLogs.filter((l) => l.clientId === person.id),
                        }
                  }
                >
                  {history.length > 0 && (
                    <Card>
                      <h2 className="mb-2 text-sm font-semibold">Body weight history</h2>
                      <ul className="divide-y divide-border border-t border-border text-sm">
                        {history
                          .slice(-12)
                          .reverse()
                          .map((w) => (
                            <li key={w.id} className="flex items-center gap-3 py-1">
                              <span className="font-mono text-xs text-muted">{w.date}</span>
                              <span className="font-mono">{w.bodyweightLbs} lb</span>
                              <ConfirmDeleteButton
                                action={deleteWeighIn.bind(null, w.id)}
                                confirmText={`Delete the ${w.date} (${w.bodyweightLbs} lb) body weight entry?`}
                                ariaLabel={`Delete body weight entry: ${w.date} (${w.bodyweightLbs} lb)`}
                                title="Delete body weight entry"
                              />
                            </li>
                          ))}
                      </ul>
                      <Note>
                        Bodyweight drives bodyweight-exercise e1RMs and the ×BW
                        comparison column — keep it fresh-ish.
                      </Note>
                    </Card>
                  )}
                </LogPane>
              ) : (
                <Overview
                  data={data}
                  client={person.id}
                  params={params}
                  personName={person.firstName}
                  today={today}
                />
              )}
            </>
          )}
        </div>
      </div>
    </PageShell>
  );
}
