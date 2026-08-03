import Link from "next/link";
import { notFound } from "next/navigation";
import { BodyHeatmap } from "@/components/body-heatmap";
import { MuscleCoverageBars } from "@/components/muscle-coverage";
import { Button, Input, PageShell, Section, SeedBanner, Select, chipClass } from "@/components/ui";
import { ProgramEditor } from "@/components/week-grid";
import {
  createAssignment,
  deleteProgram,
  updateAssignmentStatus,
} from "@/lib/actions/programs";
import { coverageByGroup, neglectedMuscles, weekCoverage } from "@/lib/coverage";
import { loadGymData } from "@/lib/db/snapshot";
import { heatMax, heatValues, ordinalMax } from "@/lib/heat";

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
      {data.source === "seed" && <SeedBanner />}
      <ProgramEditor
        program={program}
        days={days}
        routines={[...data.routines]}
      />

      <Section title="Weekly muscle coverage">
        <div className="mb-3 flex flex-wrap items-baseline gap-1 text-sm">
          <span className="mr-2 text-xs uppercase tracking-wide text-muted">Week</span>
          {Array.from({ length: program.weeks }, (_, i) => i + 1).map((w) => (
            <Link
              key={w}
              href={`/programs/${programId}?week=${w}`}
              className={chipClass(w === week, "min-h-10 min-w-10 justify-center px-2 font-mono text-xs")}
            >
              {w}
            </Link>
          ))}
        </div>
        {neglected.length > 0 && (
          <p className="mb-3 text-xs text-danger-text">
            Possibly neglected in week {week}:{" "}
            <strong>{neglected.join(", ")}</strong>
          </p>
        )}
        <div className="flex flex-col gap-8 lg:flex-row lg:items-start">
          <div className="min-w-0 flex-1">
            <MuscleCoverageBars groups={coverageByGroup(coverage)} />
          </div>
          <div className="shrink-0">
            <BodyHeatmap
              values={heat}
              title={`Week ${week} body map`}
              maxLabel={`${coverageMax.toFixed(1)} sets/wk`}
            />
          </div>
        </div>
      </Section>

      <Section title="Assignments">
        {assignments.length > 0 && (
          <ul className="mb-4 space-y-2 text-sm">
            {assignments.map((assignment) => (
              <li key={assignment.id} className="flex flex-wrap items-center gap-3">
                <span className="font-semibold">
                  {data.clients.find((c) => c.id === assignment.clientId)?.firstName ??
                    assignment.clientId}
                </span>
                <span className="text-xs text-muted">
                  since {assignment.startDate}
                </span>
                <form
                  action={updateAssignmentStatus.bind(null, assignment.id)}
                  className="flex items-center gap-1"
                >
                  <Select name="status" size="sm" defaultValue={assignment.status}>
                    <option value="active">active</option>
                    <option value="paused">paused</option>
                    <option value="completed">completed</option>
                  </Select>
                  <Button type="submit" size="sm">
                    Apply
                  </Button>
                </form>
              </li>
            ))}
          </ul>
        )}

        <form action={createAssignment} className="flex flex-wrap items-center gap-2 text-sm">
          <input type="hidden" name="programId" value={programId} />
          <Select name="clientId">
            {data.clients.map((client) => (
              <option key={client.id} value={client.id}>
                {client.firstName}
              </option>
            ))}
          </Select>
          <Input type="date" name="startDate" required />
          <Button type="submit">Assign</Button>
        </form>
      </Section>

      <form action={deleteProgram.bind(null, programId)} className="mt-10">
        <Button type="submit" variant="danger" size="sm">
          Delete program
        </Button>
      </form>
    </PageShell>
  );
}
