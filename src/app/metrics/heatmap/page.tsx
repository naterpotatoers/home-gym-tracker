import { BodyHeatmap } from "@/components/body-heatmap";
import { HeatmapControls } from "@/components/heatmap-controls";
import { Note, PageShell } from "@/components/ui";
import { weekCoverage } from "@/lib/coverage";
import { loadGymData } from "@/lib/db/snapshot";
import {
  heatMax,
  heatValues,
  ordinalMax,
  type HeatInputs,
  type HeatValue,
} from "@/lib/heat";
import { parseHeatmapParams } from "@/lib/heatmap-url";
import { resolvePeriod } from "@/lib/periods";
import { muscleVolume } from "@/lib/queries";
import type { MuscleId } from "@/lib/types";

type Panel = { title: string; values: Map<MuscleId, HeatValue> };

export default async function HeatmapPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const raw = await searchParams;
  const data = await loadGymData();

  const params = parseHeatmapParams(raw, data);
  const { client: clientId, mode, period } = params;
  const comparing = params.compare === "1";

  let panels: Panel[] = [];
  let maxLabel = "";
  let ordinalMaxLabel: string | undefined;
  let prevAnchor: string | null = null;
  let nextAnchor: string | null = null;

  if (mode === "logged") {
    const clientName = data.clientById.get(clientId)?.firstName ?? clientId;
    const periodA = resolvePeriod(data, clientId, {
      period,
      date: raw.date,
      from: raw.from,
      to: raw.to,
      program: raw.program,
    });
    prevAnchor = periodA.prevAnchor;
    nextAnchor = periodA.nextAnchor;

    const sides: { title: string; inputs: HeatInputs }[] = [
      {
        title: `${clientName} — ${periodA.label}`,
        inputs: {
          volumes: muscleVolume(data, clientId, { from: periodA.from, to: periodA.to }),
        },
      },
    ];
    if (comparing) {
      const periodB = resolvePeriod(data, clientId, {
        period,
        date: raw.bDate ?? raw.date,
        from: raw.bFrom,
        to: raw.bTo,
        program: raw.bProgram,
      });
      sides.push({
        title: `${clientName} — ${periodB.label}`,
        inputs: {
          volumes: muscleVolume(data, clientId, { from: periodB.from, to: periodB.to }),
        },
      });
    }

    const max = heatMax(...sides.map((s) => s.inputs));
    const ordMax = ordinalMax(...sides.map((s) => s.inputs));
    maxLabel = `${Math.round(max).toLocaleString()} lb·reps`;
    ordinalMaxLabel = ordMax > 0 ? `${Math.round(ordMax)} reps` : undefined;
    panels = sides.map((side) => ({
      title: side.title,
      values: heatValues(side.inputs, max, ordMax),
    }));
  } else {
    const programs = [...data.programs];
    const programA =
      programs.find((p) => p.id === raw.program) ?? programs[0];
    if (programA) {
      const weekA = Math.min(
        programA.weeks,
        Math.max(1, Number.parseInt(raw.week ?? "1", 10) || 1),
      );
      const sides: { title: string; inputs: HeatInputs }[] = [
        {
          title: `${programA.name} — week ${weekA}`,
          inputs: { coverage: weekCoverage(data, programA.id, weekA) },
        },
      ];
      if (comparing) {
        const programB = programs.find((p) => p.id === raw.bProgram) ?? programA;
        const weekB = Math.min(
          programB.weeks,
          Math.max(1, Number.parseInt(raw.bWeek ?? "1", 10) || 1),
        );
        sides.push({
          title: `${programB.name} — week ${weekB}`,
          inputs: { coverage: weekCoverage(data, programB.id, weekB) },
        });
      }
      const max = heatMax(...sides.map((s) => s.inputs));
      maxLabel = `${max.toFixed(1)} sets`;
      panels = sides.map((side) => ({
        title: side.title,
        values: heatValues(side.inputs, max, 0),
      }));
    }
  }

  return (
    <PageShell>
      <h1 className="text-3xl font-bold tracking-tight">Muscle heat map</h1>
      <p className="mt-2 text-sm text-muted">
        {mode === "logged"
          ? "Trained volume per muscle, from logged sets."
          : "Prescribed weekly coverage per muscle, from the program's routines."}
      </p>

      <HeatmapControls
        people={data.clients.map((c) => ({ id: c.id, firstName: c.firstName }))}
        params={params}
        programs={[...data.programs]}
        prevAnchor={prevAnchor}
        nextAnchor={nextAnchor}
      />

      {panels.length === 0 ? (
        <p className="mt-8 text-sm text-muted">No programs to show yet.</p>
      ) : (
        <div className={`mt-8 grid gap-8 ${panels.length > 1 ? "sm:grid-cols-2" : ""}`}>
          {panels.map((panel) => (
            <BodyHeatmap
              key={panel.title}
              values={panel.values}
              title={panel.title}
              maxLabel={maxLabel}
              ordinalMaxLabel={ordinalMaxLabel}
            />
          ))}
        </div>
      )}

      <Note>
        Intensity is score-weighted {mode === "logged" ? "load × reps" : "sets"},
        normalized against the largest muscle across every figure shown — two
        periods side by side share one scale, so lighter genuinely means less
        work. Hatched regions were trained only with bands, which have no pound
        value; they sit on their own reps scale rather than faking one. Dashed
        outlines mark deep muscles drawn as callouts.
      </Note>
    </PageShell>
  );
}
