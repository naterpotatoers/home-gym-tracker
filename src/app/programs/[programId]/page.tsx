import Link from "next/link";
import { notFound } from "next/navigation";
import { MuscleCoverageBars } from "@/components/muscle-coverage";
import { Section, SeedBanner } from "@/components/ui";
import { ProgramEditor } from "@/components/week-grid";
import {
  createAssignment,
  deleteProgram,
  updateAssignmentStatus,
} from "@/lib/actions/programs";
import { coverageByGroup, neglectedMuscles, weekCoverage } from "@/lib/coverage";
import { clients } from "@/lib/data/clients";
import { loadGymData } from "@/lib/db/snapshot";

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
  const assignments = data.assignments.filter((a) => a.programId === programId);

  return (
    <main className="mx-auto w-full max-w-5xl px-6 py-10 font-sans">
      {data.source === "seed" && <SeedBanner />}
      <ProgramEditor
        program={program}
        days={days}
        routines={[...data.routines]}
      />

      <Section title="Weekly muscle coverage">
        <div className="mb-3 flex flex-wrap items-baseline gap-1 text-sm">
          <span className="mr-2 text-xs uppercase tracking-wide opacity-60">Week</span>
          {Array.from({ length: program.weeks }, (_, i) => i + 1).map((w) => (
            <Link
              key={w}
              href={`/programs/${programId}?week=${w}`}
              className={`rounded px-2 py-0.5 font-mono text-xs ${
                w === week ? "bg-current/15 font-semibold" : "opacity-50 hover:opacity-100"
              }`}
            >
              {w}
            </Link>
          ))}
        </div>
        {neglected.length > 0 && (
          <p className="mb-3 text-xs opacity-70">
            Possibly neglected in week {week}:{" "}
            <strong>{neglected.join(", ")}</strong>
          </p>
        )}
        <MuscleCoverageBars groups={coverageByGroup(coverage)} />
      </Section>

      <Section title="Assignments">
        {assignments.length > 0 && (
          <ul className="mb-4 space-y-2 text-sm">
            {assignments.map((assignment) => (
              <li key={assignment.id} className="flex flex-wrap items-center gap-3">
                <span className="font-semibold">
                  {clients.find((c) => c.id === assignment.clientId)?.firstName ??
                    assignment.clientId}
                </span>
                <span className="text-xs opacity-60">
                  since {assignment.startDate}
                </span>
                <form
                  action={updateAssignmentStatus.bind(null, assignment.id)}
                  className="flex items-center gap-1"
                >
                  <select
                    name="status"
                    defaultValue={assignment.status}
                    className="rounded border border-current/20 bg-transparent px-1 py-0.5 text-xs"
                  >
                    <option value="active">active</option>
                    <option value="paused">paused</option>
                    <option value="completed">completed</option>
                  </select>
                  <button
                    type="submit"
                    className="rounded border border-current/20 px-2 py-0.5 text-xs hover:bg-current/10"
                  >
                    Apply
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}

        <form action={createAssignment} className="flex flex-wrap items-center gap-2 text-sm">
          <input type="hidden" name="programId" value={programId} />
          <select
            name="clientId"
            className="rounded border border-current/20 bg-transparent px-2 py-1 text-sm"
          >
            {clients.map((client) => (
              <option key={client.id} value={client.id}>
                {client.firstName}
              </option>
            ))}
          </select>
          <input
            type="date"
            name="startDate"
            required
            className="rounded border border-current/20 bg-transparent px-2 py-1 text-sm"
          />
          <button
            type="submit"
            className="rounded border border-current/20 px-3 py-1 text-sm font-semibold hover:bg-current/10"
          >
            Assign
          </button>
        </form>
      </Section>

      <form action={deleteProgram.bind(null, programId)} className="mt-10">
        <button type="submit" className="text-xs opacity-50 hover:opacity-100">
          Delete program
        </button>
      </form>
    </main>
  );
}
