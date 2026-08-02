import Link from "next/link";
import { MetricsControls, type MetricsView } from "@/components/metrics-controls";
import { Note, PageShell, Section, SeedBanner, Td, Th } from "@/components/ui";
import { clients } from "@/lib/data/clients";
import { exerciseById } from "@/lib/data/exercises";
import { modalityById } from "@/lib/data/modalities";
import { loadGymData } from "@/lib/db/snapshot";
import {
  hipBandLadder,
  personalRecords,
  prComparison,
  repRangeForWeight,
  trainedVariants,
  workingWeightForRepRange,
} from "@/lib/queries";
import { isExerciseId, isModalityId } from "@/lib/validate";

export default async function MetricsPage({
  searchParams,
}: {
  searchParams: Promise<{
    exercise?: string;
    modality?: string;
    view?: string;
    repMin?: string;
    repMax?: string;
    weight?: string;
  }>;
}) {
  const params = await searchParams;
  const data = await loadGymData();
  const variants = trainedVariants(data);

  const exercise =
    params.exercise && isExerciseId(params.exercise) ? params.exercise : null;
  const modality =
    params.modality && isModalityId(params.modality) ? params.modality : null;
  const selected = exercise && modality ? { exerciseId: exercise, modalityId: modality } : null;
  const view: MetricsView = ["prs", "weight-for-reps", "reps-for-weight"].includes(
    params.view ?? "",
  )
    ? (params.view as MetricsView)
    : "prs";
  const repMin = Math.max(1, Number.parseInt(params.repMin ?? "8", 10) || 8);
  const repMax = Math.max(repMin, Number.parseInt(params.repMax ?? "12", 10) || 12);
  const weight = Math.max(0, Number.parseFloat(params.weight ?? "100") || 100);

  const isDumbbell = selected?.modalityId === "dumbbell";
  const isHipBandWork =
    selected !== null &&
    selected.modalityId === "band" &&
    prComparison(data, selected.exerciseId, selected.modalityId).every(
      (row) => row.bestE1rmLbs === null,
    );

  return (
    <PageShell>
      {data.source === "seed" && <SeedBanner />}
      <h1 className="text-3xl font-bold tracking-tight">Historical metrics</h1>
      <p className="mt-2 text-sm opacity-70">
        Pick a trained exercise variant to compare clients, or ask what weight
        fits a rep range — and the reverse. For per-muscle intensity, see the{" "}
        <Link href="/metrics/heatmap" className="underline underline-offset-2">
          muscle heat map
        </Link>
        .
      </p>

      <MetricsControls
        variants={variants}
        selected={selected}
        view={view}
        repMin={repMin}
        repMax={repMax}
        weight={weight}
      />

      {/* ---- No variant: cross-client PR overview -------------------- */}
      {!selected && (
        <div className="mt-4 grid gap-8 lg:grid-cols-2">
          {clients.map((client) => {
            const records = personalRecords(data, client.id).slice(0, 6);
            return (
              <Section key={client.id} title={client.firstName}>
                {records.length === 0 ? (
                  <p className="text-sm opacity-60">No loaded sets logged yet.</p>
                ) : (
                  <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border-strong text-left">
                          <Th>Exercise</Th>
                          <Th>Modality</Th>
                          <Th numeric>e1RM</Th>
                          <Th numeric>Heaviest</Th>
                        </tr>
                      </thead>
                      <tbody>
                        {records.map((r) => (
                          <tr
                            key={`${r.exerciseId}-${r.modalityId}`}
                            className="border-b border-border"
                          >
                            <Td>{exerciseById.get(r.exerciseId)?.name}</Td>
                            <Td>{modalityById.get(r.modalityId)?.name}</Td>
                            <Td numeric>{Math.round(r.bestE1rmLbs)} lb</Td>
                            <Td numeric>{r.heaviestLbs} lb</Td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </Section>
            );
          })}
        </div>
      )}

      {/* ---- Hip-band variant: rank ladder, no weight math ----------- */}
      {selected && isHipBandWork && (
        <Section title="Band progression">
          <p className="text-sm opacity-70">
            This variant is trained with hip bands, which have no pound rating —
            progress is by band rank, not load. Ladder, easiest to hardest:{" "}
            <strong>
              {hipBandLadder()
                .map(({ band }) => `${band.label} ${band.sizeInches}"`)
                .join(" → ")}
            </strong>
            .
          </p>
        </Section>
      )}

      {/* ---- PR comparison ------------------------------------------- */}
      {selected && !isHipBandWork && view === "prs" && (
        <Section
          title={`${exerciseById.get(selected.exerciseId)?.name} — ${modalityById.get(selected.modalityId)?.name}`}
        >
          <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border-strong text-left">
                  <Th>Client</Th>
                  <Th numeric>Best e1RM</Th>
                  <Th numeric>Heaviest</Th>
                  <Th numeric>× bodyweight</Th>
                  <Th>Date</Th>
                </tr>
              </thead>
              <tbody>
                {prComparison(data, selected.exerciseId, selected.modalityId).map((row) => (
                  <tr key={row.clientId} className="border-b border-border">
                    <Td>{clients.find((c) => c.id === row.clientId)?.firstName}</Td>
                    <Td numeric>
                      {row.bestE1rmLbs !== null ? `${Math.round(row.bestE1rmLbs)} lb` : "—"}
                    </Td>
                    <Td numeric>
                      {row.heaviestLbs !== null ? `${row.heaviestLbs} lb` : "—"}
                    </Td>
                    <Td numeric>{row.relative !== null ? row.relative.toFixed(2) : "—"}</Td>
                    <Td>{row.date ?? "—"}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Note>
            e1RM is Epley-estimated from the best completed working set. Weights
            are total pounds moved per rep{isDumbbell && " (both dumbbells)"}.
            Warmups and incomplete sets never count.
          </Note>
        </Section>
      )}

      {/* ---- Working weight for a rep range -------------------------- */}
      {selected && !isHipBandWork && view === "weight-for-reps" && (
        <Section
          title={`Working weight for ${repMin}–${repMax} reps — ${exerciseById.get(selected.exerciseId)?.name}`}
        >
          <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border-strong text-left">
                  <Th>Client</Th>
                  <Th numeric>Best actual in range</Th>
                  <Th numeric>Predicted at {repMax} reps</Th>
                  <Th numeric>Loadable bar</Th>
                </tr>
              </thead>
              <tbody>
                {clients.map((client) => {
                  const answer = workingWeightForRepRange(
                    data,
                    client.id,
                    selected.exerciseId,
                    selected.modalityId,
                    repMin,
                    repMax,
                  );
                  return (
                    <tr key={client.id} className="border-b border-border">
                      <Td>{client.firstName}</Td>
                      <Td numeric>
                        {answer.bestActual
                          ? `${answer.bestActual.weightLbs} lb × ${answer.bestActual.reps} (${answer.bestActual.date})`
                          : "—"}
                      </Td>
                      <Td numeric>
                        {answer.predicted !== null
                          ? `${Math.round(answer.predicted)} lb${
                              isDumbbell ? ` (${Math.round(answer.predicted / 2)} ea)` : ""
                            }`
                          : "—"}
                      </Td>
                      <Td numeric>
                        {answer.suggestedBarLoad !== null
                          ? `${answer.suggestedBarLoad} lb`
                          : "—"}
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <Note>
            &ldquo;Best actual&rdquo; is the heaviest completed set that landed in
            the range. The prediction inverts Epley at the top of the range, and
            &ldquo;loadable bar&rdquo; snaps it to the nearest weight the plate
            inventory can build. All weights are total pounds per rep
            {isDumbbell && " — dumbbell shows per-implement in parentheses"}.
          </Note>
        </Section>
      )}

      {/* ---- Rep range for a weight ---------------------------------- */}
      {selected && !isHipBandWork && view === "reps-for-weight" && (
        <Section
          title={`Reps at ${weight} lb — ${exerciseById.get(selected.exerciseId)?.name}`}
        >
          <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border-strong text-left">
                  <Th>Client</Th>
                  <Th numeric>Most reps at ≥ {weight} lb</Th>
                  <Th numeric>Predicted reps</Th>
                </tr>
              </thead>
              <tbody>
                {clients.map((client) => {
                  const answer = repRangeForWeight(
                    data,
                    client.id,
                    selected.exerciseId,
                    selected.modalityId,
                    weight,
                  );
                  return (
                    <tr key={client.id} className="border-b border-border">
                      <Td>{client.firstName}</Td>
                      <Td numeric>
                        {answer.bestActual
                          ? `${answer.bestActual.reps} × ${answer.bestActual.weightLbs} lb (${answer.bestActual.date})`
                          : "—"}
                      </Td>
                      <Td numeric>
                        {answer.predictedReps !== null
                          ? answer.predictedReps < 0.5
                            ? "above e1RM"
                            : `~${Math.round(answer.predictedReps)}`
                          : "—"}
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <Note>
            Prediction inverts Epley from each client&apos;s best e1RM — a dash
            means no loaded history for this variant. Weight is total pounds per
            rep{isDumbbell && " (both dumbbells combined)"}.
          </Note>
        </Section>
      )}
    </PageShell>
  );
}
