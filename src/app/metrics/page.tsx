import Link from "next/link";
import { ProgressControls } from "@/components/progress-controls";
import { PageShell, SeedBanner, Stat } from "@/components/ui";
import { exerciseById } from "@/lib/data/exercises";
import { MUSCLE_GROUP_COLORS } from "@/lib/data/muscles";
import { modalityById } from "@/lib/data/modalities";
import { loadGymData } from "@/lib/db/snapshot";
import type { ProgressParams } from "@/lib/progress-url";
import { availableVariants, clientSummaries, trainedVariants } from "@/lib/queries";
import type { ClientId } from "@/lib/types";
import { isExerciseId, isModalityId } from "@/lib/validate";
import { ExerciseView } from "./_components/exercise-view";
import { Overview } from "./_components/overview";

function clampInt(raw: string | undefined, fallback: number, min: number): number {
  const n = Number.parseInt(raw ?? "", 10);
  return Number.isFinite(n) && n >= min ? n : fallback;
}

export default async function ProgressPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const raw = await searchParams;
  const data = await loadGymData();

  const client: ClientId =
    raw.client && data.clientById.has(raw.client) ? raw.client : "nate";
  const person = data.clientById.get(client)!;
  const selected =
    raw.exercise && raw.modality && isExerciseId(raw.exercise) && isModalityId(raw.modality)
      ? { exerciseId: raw.exercise, modalityId: raw.modality }
      : null;

  const params: ProgressParams = {
    client,
    exercise: selected?.exerciseId ?? "",
    modality: selected?.modalityId ?? "",
    repMin: clampInt(raw.repMin, 8, 1),
    repMax: clampInt(raw.repMax, 12, 1),
    weight: clampInt(raw.weight, 100, 0),
    sort: raw.sort === "volume" || raw.sort === "status" ? raw.sort : "group",
    filter: raw.filter === "needs-work" ? "needs-work" : "all",
    mod: raw.mod && isModalityId(raw.mod) ? raw.mod : "",
    group:
      raw.group && raw.group in MUSCLE_GROUP_COLORS
        ? raw.group
        : "",
  };

  const people = data.clients.map((c) => ({
    id: c.id,
    firstName: c.firstName,
    color: c.color,
  }));
  const trainedKeys = new Set(
    trainedVariants(data)
      .filter((v) => v.clients.includes(client))
      .map((v) => `${v.exerciseId}|${v.modalityId}`),
  );
  const pickerVariants = availableVariants().filter((v) =>
    trainedKeys.has(`${v.exerciseModality.exerciseId}|${v.exerciseModality.modalityId}`),
  );
  const selectedLabel = selected
    ? `${exerciseById.get(selected.exerciseId)?.name ?? selected.exerciseId} — ${
        modalityById.get(selected.modalityId)?.name ?? selected.modalityId
      }`
    : null;
  const summary = clientSummaries(data).find((s) => s.client.id === client);

  return (
    <PageShell>
      {data.source === "seed" && <SeedBanner />}
      <h1 className="text-3xl font-bold tracking-tight">Progress</h1>
      <p className="mt-2 text-sm text-muted">
        Pick a person, pick a lift, see if the number is going up. Muscle heat
        over time lives in the{" "}
        <Link href="/metrics/heatmap" className="text-accent-text underline underline-offset-2">
          heat map
        </Link>
        .
      </p>

      <ProgressControls
        params={params}
        people={people}
        variants={pickerVariants}
        selectedLabel={selectedLabel}
      />

      {summary && (
        <dl className="mt-4 flex flex-wrap gap-x-8 gap-y-2">
          <Stat label="Sessions" value={String(summary.sessionCount)} />
          <Stat label="Last trained" value={summary.lastSessionDate ?? "—"} />
          <Stat
            label="Bodyweight"
            value={
              summary.bodyweightLbs === null
                ? "—"
                : `${summary.bodyweightLbs} lb${
                    summary.bodyweightChangeLbs !== null
                      ? ` (${summary.bodyweightChangeLbs > 0 ? "+" : ""}${summary.bodyweightChangeLbs})`
                      : ""
                  }`
            }
          />
        </dl>
      )}

      {selected === null ? (
        <Overview data={data} client={client} params={params} />
      ) : (
        <ExerciseView
          data={data}
          client={client}
          personName={person.firstName}
          exerciseId={selected.exerciseId}
          modalityId={selected.modalityId}
          params={params}
        />
      )}
    </PageShell>
  );
}
