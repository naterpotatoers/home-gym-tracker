import { isCareRoutine } from "./data/care-routines";
import { activeAssignment, type GymData } from "./gym-data";
import { programEnded, shortDayLabel } from "./periods";
import { routineForDay } from "./queries";
import type { ClientId } from "./types";

/**
 * The home launcher's per-person plan select. Its option values are the
 * contract between the page and startGroupFromForm — always build them with
 * planValue and read them with parsePlanValue.
 */
export type Plan =
  | { kind: "resume"; sessionId: string }
  | { kind: "start"; routineId: string; assignmentId: string | null };

const RESUME = "resume:";

export function planValue(plan: Plan): string {
  return plan.kind === "resume"
    ? `${RESUME}${plan.sessionId}`
    : `${plan.routineId}|${plan.assignmentId ?? ""}`;
}

/** Null for anything planValue can't have produced. */
export function parsePlanValue(value: string): Plan | null {
  if (value.startsWith(RESUME)) {
    const sessionId = value.slice(RESUME.length);
    return sessionId ? { kind: "resume", sessionId } : null;
  }
  const parts = value.split("|");
  if (parts.length !== 2 || !parts[0]) return null;
  return { kind: "start", routineId: parts[0], assignmentId: parts[1] || null };
}

/** One person on the launcher — plain data only (it crosses the server →
 *  client boundary). */
export type LauncherRow = {
  clientId: ClientId;
  firstName: string;
  color: string | null;
  /** `group` becomes an <optgroup>; options arrive already in group order. */
  options: { value: string; label: string; group: string }[];
  defaultPlan: string;
  defaultChecked: boolean;
  unfinished: { id: string; name: string; date: string }[];
  /** The active program has run its length — prompt instead of serving it. */
  finishedProgram: { assignmentId: string; programName: string } | null;
};

/**
 * Everyone's launcher row for `today` (`dow` 1 = Monday). Options lead with
 * unfinished sessions to resume, then today's program day, the rest of the
 * program, other routines, and care work last (it's also offered as a
 * finisher). Anyone with something to resume or a program day starts
 * checked; otherwise the default is what they did last.
 */
export function launcherRows(data: GymData, today: string, dow: number): LauncherRow[] {
  const routines = [...data.routines].sort((a, b) => a.name.localeCompare(b.name));
  const routineName = (id: string | null) => data.routineById.get(id ?? "")?.name ?? "session";

  return data.clients.map((client) => {
    const planned = data.sessions
      .filter((s) => s.clientId === client.id && s.status === "planned")
      .sort((a, b) => b.date.localeCompare(a.date));
    const assignment = activeAssignment(data, client.id);
    const program = assignment ? data.programById.get(assignment.programId) : undefined;
    const ended = !!assignment && !!program && programEnded(assignment, program, today);
    const todaysRoutine = routineForDay(data, client.id, dow, today);

    const programGroup = program && !ended ? program.name : null;
    const programRoutineIds = new Set(
      programGroup
        ? data.programDays.filter((d) => d.programId === program!.id).map((d) => d.routineId)
        : [],
    );
    const start = (routineId: string, assignmentId: string | null) =>
      planValue({ kind: "start", routineId, assignmentId });
    const options: LauncherRow["options"] = [
      ...planned.map((s) => ({
        value: planValue({ kind: "resume", sessionId: s.id }),
        label: `Resume: ${routineName(s.routineId)} (${shortDayLabel(s.date, today)})`,
        group: "Resume",
      })),
      ...(todaysRoutine
        ? [
            {
              value: start(todaysRoutine.routineId, assignment?.id ?? null),
              label: `${routineName(todaysRoutine.routineId)} — today's program day`,
              group: programGroup ?? "Program",
            },
          ]
        : []),
      ...routines
        .filter((r) => programRoutineIds.has(r.id) && r.id !== todaysRoutine?.routineId)
        .map((r) => ({ value: start(r.id, assignment?.id ?? null), label: r.name, group: programGroup! })),
      ...routines
        .filter((r) => !programRoutineIds.has(r.id) && !isCareRoutine(r))
        .map((r) => ({ value: start(r.id, null), label: r.name, group: "Other routines" })),
      ...routines
        .filter((r) => !programRoutineIds.has(r.id) && isCareRoutine(r))
        .map((r) => ({ value: start(r.id, null), label: r.name, group: "Care & mobility" })),
    ];

    // No resume and no program day: default to what they did last (program
    // routines carry the assignment in their value) rather than whichever
    // routine sorts first.
    const lastRoutineId = data.sessions
      .filter((s) => s.clientId === client.id && s.status === "completed" && s.routineId)
      .sort((a, b) => b.date.localeCompare(a.date))[0]?.routineId;
    const lastValue = options.find((o) => {
      const plan = parsePlanValue(o.value);
      return plan?.kind === "start" && plan.routineId === lastRoutineId;
    })?.value;
    const defaultPlan =
      planned.length > 0 || todaysRoutine || !lastValue ? (options[0]?.value ?? "") : lastValue;

    return {
      clientId: client.id,
      firstName: client.firstName,
      color: client.color,
      options,
      defaultPlan,
      defaultChecked: planned.length > 0 || todaysRoutine !== null,
      finishedProgram:
        ended && assignment && program
          ? { assignmentId: assignment.id, programName: program.name }
          : null,
      unfinished: planned.map((s) => ({ id: s.id, name: routineName(s.routineId), date: s.date })),
    };
  });
}
