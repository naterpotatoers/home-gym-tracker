import Link from "next/link";
import { notFound } from "next/navigation";
import { BodyHeatmap } from "@/components/body-heatmap";
import { PlusIcon, SaveIcon, TrashIcon } from "@/components/icons";
import { MuscleCoverageBars } from "@/components/muscle-coverage";
import {
  Button,
  chipClass,
  ColorDot,
  Input,
  Note,
  PageShell,
  Section,
  Select,
  TableScroll,
  Td,
  Th,
} from "@/components/ui";
import { ProgramEditor } from "@/components/week-grid";
import {
  createAssignment,
  deleteProgram,
  updateAssignmentStatus,
} from "@/lib/actions/programs";
import { coverageByGroup, neglectedMuscles, weekCoverage } from "@/lib/coverage";
import { loadGymData } from "@/lib/db/snapshot";
import { catalogSlice } from "@/lib/exercise-catalog";
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
              catalog={catalogSlice(data)}
              title={`Week ${week} body map`}
              maxLabel={`${coverageMax.toFixed(1)} sets/wk`}
            />
          </div>
        </div>
      </Section>

      <Section
        title="Assignments"
        action={
          <form action={createAssignment} className="flex flex-wrap items-center gap-2 pb-1">
            <input type="hidden" name="programId" value={programId} />
            <Select name="clientId" size="sm">
              {data.clients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.firstName}
                </option>
              ))}
            </Select>
            <Input type="date" name="startDate" required size="sm" />
            <Button type="submit" variant="primary" size="sm">
              <PlusIcon size={16} /> Assign
            </Button>
          </form>
        }
      >
        {assignments.length === 0 ? (
          <Note>
            Nobody is on this program yet — assign someone above and their
            workouts will follow its weekly schedule.
          </Note>
        ) : (
          <TableScroll>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border-strong text-left">
                  <Th>Client</Th>
                  <Th>Since</Th>
                  <Th>Status</Th>
                </tr>
              </thead>
              <tbody>
                {assignments.map((assignment) => {
                  const client = data.clientById.get(assignment.clientId);
                  return (
                    <tr key={assignment.id} className="border-b border-border">
                      <Td>
                        <span className="inline-flex items-center gap-1.5 font-semibold">
                          <ColorDot color={client?.color} />
                          {client?.firstName ?? assignment.clientId}
                        </span>
                      </Td>
                      <Td>
                        <span className="font-mono text-xs">{assignment.startDate}</span>
                      </Td>
                      <Td>
                        <form
                          action={updateAssignmentStatus.bind(null, assignment.id)}
                          className="flex items-center gap-1.5"
                        >
                          <Select name="status" size="sm" defaultValue={assignment.status}>
                            <option value="active">active</option>
                            <option value="paused">paused</option>
                            <option value="completed">completed</option>
                          </Select>
                          <Button type="submit" size="sm" title="Apply status change">
                            <SaveIcon size={14} /> Apply
                          </Button>
                        </form>
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </TableScroll>
        )}
      </Section>

      <form action={deleteProgram.bind(null, programId)} className="mt-10">
        <Button type="submit" variant="danger" size="sm">
          <TrashIcon size={16} /> Delete program
        </Button>
      </form>
    </PageShell>
  );
}
