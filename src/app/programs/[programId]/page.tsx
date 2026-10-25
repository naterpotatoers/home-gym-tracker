import Link from "next/link";
import { notFound } from "next/navigation";
import { BodyHeatmap } from "@/components/body-heatmap";
import { AssignmentChips } from "@/components/assignment-chips";
import { MuscleCoverageBars } from "@/components/muscle-coverage";
import { chipClass, PageShell, Section } from "@/components/ui";
import { ProgramEditor } from "@/components/week-grid";
import { coverageByGroup, neglectedMuscles, weekCoverage } from "@/lib/coverage";
import { loadGymData } from "@/lib/db/snapshot";
import { catalogSlice } from "@/lib/exercise-catalog";
import { heatMax, heatValues, ordinalMax } from "@/lib/heat";
import { localTodayIso, mondayOf } from "@/lib/periods";

export default async function ProgramPage({
  params,
  searchParams,
}: {
  params: Promise<{ programId: string }>;
  searchParams: Promise<{ week?: string }>;
}) {
  const [{ programId }, { week: weekParam }] = await Promise.all([
    params,
    searchParams,
  ]);
  const data = await loadGymData();
  const program = data.programById.get(programId);
  if (!program) notFound();

  const week = Math.min(
    program.weeks,
    Math.max(1, Number.parseInt(weekParam ?? "1", 10) || 1),
  );
  const days = data.programDays.filter((d) => d.programId === programId);
  const coverage = weekCoverage(data, programId, week);
  const neglected = neglectedMuscles(coverage);
  const coverageMax = heatMax({ coverage });
  const heat = heatValues({ coverage }, coverageMax, ordinalMax({ coverage }));
  const assignments = data.assignments.filter((a) => a.programId === programId);

  return (
    <PageShell>
      <ProgramEditor
        program={program}
        days={days}
        routines={[...data.routines]}
      />

      <AssignmentChips
        programId={programId}
        assignments={assignments.map((a) => {
          const client = data.clientById.get(a.clientId);
          return { ...a, firstName: client?.firstName ?? a.clientId, color: client?.color ?? null };
        })}
        clients={data.clients.map((c) => ({ id: c.id, firstName: c.firstName }))}
        defaultStartDate={mondayOf(localTodayIso())}
      />

      <Section title="Weekly muscle coverage">
        <div className="mb-3 flex flex-wrap items-baseline gap-1 text-sm">
          <span className="mr-2 text-xs uppercase tracking-wide text-muted">Week</span>
          {Array.from({ length: program.weeks }, (_, i) => i + 1).map((w) => (
            <Link
              key={w}
              href={`/programs/${programId}?week=${w}`}
              scroll={false}
              className={chipClass(w === week, "min-h-11 min-w-11 justify-center px-2 font-mono text-xs")}
            >
              {w}
            </Link>
          ))}
        </div>
        {neglected.length > 0 && (
          // The bars below name each one (with a status label) — this is
          // just the count, not a wall of names.
          <p className="mb-3 text-xs text-danger-text">
            <strong>
              {neglected.length} of {coverage.size} muscles
            </strong>{" "}
            possibly neglected in week {week}
          </p>
        )}
        <div className="flex flex-col gap-8 lg:flex-row lg:items-start">
          <div className="min-w-0 flex-1">
            <MuscleCoverageBars groups={coverageByGroup(coverage)} />
          </div>
          <div className="shrink-0">
            <BodyHeatmap
              values={[...heat]}
              catalog={catalogSlice(data)}
              title={`Week ${week} body map`}
              maxLabel={`${coverageMax.toFixed(1)} sets/wk`}
            />
          </div>
        </div>
      </Section>

    </PageShell>
  );
}
