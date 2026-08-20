import Link from "next/link";
import { PlayIcon } from "@/components/icons";
import { StartRowButton } from "@/components/start-row-button";
import {
  chipClass,
  clientBorderStyle,
  ColorDot,
  IconButton,
  Note,
  PageShell,
  Section,
  Stat,
} from "@/components/ui";
import { startSession } from "@/lib/actions/workout";
import { bars, dumbbells } from "@/lib/data/equipment";
import { modalities } from "@/lib/data/modalities";
import { loadGymData } from "@/lib/db/snapshot";
import { localDayLabel, localTodayIso, todayDow } from "@/lib/periods";
import { loadableWeights, smallestIncrement } from "@/lib/loading";
import {
  availableVariants,
  hipBandLadder,
  openBoardGroups,
  resumeTargetForClient,
  routineForDay,
} from "@/lib/queries";

const FLOWS = [
  {
    href: "/programs",
    title: "Plan",
    blurb:
      "Build daily routines, arrange them into weekly programs, and see which muscles a week neglects.",
  },
  {
    href: "/users",
    title: "Clients",
    blurb:
      "Everyone who trains here — profiles, bodyweight, lift history, PRs, and whether the number is actually going up.",
  },
  {
    href: "/workout",
    title: "Start a Workout",
    blurb:
      "Run today's program day or any routine. Swap exercises and adjust every set as you go.",
  },
] as const;

export default async function Home() {
  const data = await loadGymData();

  const dow = todayDow();
  const todayIso = localTodayIso();
  // Every client gets a Today card — a prescribed program day starts in one
  // tap, and anyone without one (new client, rest day) still shows up rather
  // than silently vanishing from the roster.
  const today = data.clients.map((client) => {
    const assignment = data.assignments.find(
      (a) => a.clientId === client.id && a.status === "active",
    );
    return {
      client,
      assignmentId: assignment?.id ?? null,
      prescribed: routineForDay(data, client.id, dow, todayIso),
      // An unfinished session diverts the one-tap path to Resume — a second
      // Play here would silently strand everything already logged in it.
      resume: resumeTargetForClient(data, client.id),
    };
  });

  const inProgress = data.sessions.filter((s) => s.status === "planned");
  const boardGroups = openBoardGroups(data);

  const ohioLoads = loadableWeights("ohio_bar");
  const ownedModalities = modalities.filter((m) => m.owned);

  return (
    <PageShell>
      <h1 className="text-3xl font-bold tracking-tight">Nates Gym</h1>

      {/* Today — the reason you opened the app. One tap starts the session. */}
      <Section
        title="Today"
        action={
          <span className="text-sm text-muted">{localDayLabel(todayIso)}</span>
        }
      >
        {today.length === 0 ? (
          <p className="text-sm text-muted">
            No clients yet — add the first one at{" "}
            <Link href="/users" className="text-accent-text underline underline-offset-2">
              Clients
            </Link>
            .
          </p>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {today.map(({ client, assignmentId, prescribed, resume }) => (
              <li
                key={client.id}
                className="flex items-center gap-3 rounded-xl border border-border bg-surface px-4 py-3"
                style={clientBorderStyle(client.color)}
              >
                <ColorDot color={client.color} size="md" />
                <span className="min-w-0">
                  <span className="block font-semibold">{client.firstName}</span>
                  <span className="block truncate text-xs text-muted">
                    {resume
                      ? `Unfinished: ${data.routineById.get(resume.routineId ?? "")?.name ?? "session"} (${resume.date})`
                      : prescribed
                        ? `${data.routineById.get(prescribed.routineId)?.name} · ${prescribed.exercises.length} exercises`
                        : "No plan today"}
                  </span>
                </span>
                {resume ? (
                  <StartRowButton isResume href={resume.href} className="ml-auto" />
                ) : prescribed ? (
                  <form
                    action={startSession.bind(null, client.id, prescribed.routineId, assignmentId)}
                    className="ml-auto"
                  >
                    <IconButton
                      type="submit"
                      variant="primary"
                      title={`Start ${client.firstName}'s workout`}
                      aria-label={`Start ${client.firstName}'s workout`}
                    >
                      <PlayIcon size={20} />
                    </IconButton>
                  </form>
                ) : (
                  <Link
                    href="/workout"
                    className={`ml-auto ${chipClass(false, "min-h-9 whitespace-nowrap px-2.5 text-xs")}`}
                  >
                    Any routine
                  </Link>
                )}
              </li>
            ))}
          </ul>
        )}
      </Section>

      {inProgress.length > 0 && (
        <Section title="In progress">
          <ul className="space-y-2 text-sm">
            {boardGroups.map(({ date, sessionIds }) => (
              <li key={date}>
                <Link
                  href={`/workout/group/board?s=${sessionIds.join(",")}`}
                  className="font-semibold text-accent-text underline underline-offset-2"
                >
                  Resume group board — {date} ({sessionIds.length} clients)
                </Link>
              </li>
            ))}
            {inProgress.map((session) => (
              <li key={session.id}>
                <Link
                  href={`/workout/session/${session.id}`}
                  className="text-accent-text underline underline-offset-2"
                >
                  Resume {data.clientById.get(session.clientId)?.firstName} —{" "}
                  {data.routineById.get(session.routineId ?? "")?.name ?? "session"}{" "}
                  ({session.date})
                </Link>
              </li>
            ))}
          </ul>
        </Section>
      )}

      <div className="mt-10 grid gap-4 sm:grid-cols-3">
        {FLOWS.map((flow) => (
          <Link
            key={flow.href}
            href={flow.href}
            className="rounded-xl border border-border bg-surface p-5 hover:border-accent/50"
          >
            <h2 className="text-lg font-semibold">{flow.title}</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted">{flow.blurb}</p>
          </Link>
        ))}
      </div>

      {/* The garage in a few numbers, and how progress is scored. */}
      <Section title="Inventory">
        <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2 lg:grid-cols-3">
          <Stat
            label="Exercise variants"
            value={`${availableVariants(data).length} across ${ownedModalities.length} modalities — lifts, ab work & stretches`}
          />
          <Stat
            label="Barbell"
            value={`${bars.map((b) => b.name).join(" · ")} — ${ohioLoads[0]}–${ohioLoads.at(-1)} lb in ${smallestIncrement("ohio_bar")} lb steps`}
          />
          <Stat
            label="Dumbbells"
            value={`${dumbbells.map((d) => d.weightLbs).join(", ")} lb`}
          />
          <Stat
            label="Hip bands (easy → hard)"
            value={hipBandLadder()
              .map(({ band }) => band.label)
              .join(" → ")}
          />
          <Stat label="Clients" value={`${data.clients.length} training`} />
        </dl>
        <Note>
          Strength is scored as estimated 1RM (Epley) over completed working
          sets — warmups never count. Muscle volume is score-weighted: every
          set credits each muscle by how directly it trains it. Hip-band work
          is tracked honestly as band rank + reps, never converted to pounds.
          Stretches and mobility stay out of the volume math on purpose.
        </Note>
      </Section>
    </PageShell>
  );
}
