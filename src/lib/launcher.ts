import { finisherGroupLabel } from "./care";
import { isCareRoutine } from "./data/care-routines";
import { isCoreRoutine } from "./data/core-routines";
import { activeAssignment, type GymData } from "./gym-data";
import { programEnded, shortDayLabel } from "./periods";
import { programWeekStatus } from "./planning";
import { routineForDay } from "./queries";
import { wantsBikeWarmup } from "./warmup";
import type { ClientId, Routine } from "./types";

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
  /** `group` becomes an <optgroup>; options arrive already in group order.
   *  `bikeWarmup`: starting this opens with the Echo Bike warm-up (lifting
   *  routines; never resumes, care or core work). */
  options: { value: string; label: string; group: string; bikeWarmup: boolean }[];
  defaultPlan: string;
  defaultChecked: boolean;
  unfinished: { id: string; name: string; date: string }[];
  /** The active program has run its length — prompt instead of serving it. */
  finishedProgram: { assignmentId: string; programName: string } | null;
};

const OTHER_ROUTINES = "Other routines";
/** The groups after the program's, in order: care and core work last (both
 *  are also offered as finishers). */
const TAIL_GROUPS = [OTHER_ROUTINES, finisherGroupLabel("care"), finisherGroupLabel("core")];

/** The launcher group of a routine outside the person's program. */
export function routineGroup(routine: Pick<Routine, "id" | "name">): string {
  if (isCareRoutine(routine)) return finisherGroupLabel("care");
  if (isCoreRoutine(routine)) return finisherGroupLabel("core");
  return OTHER_ROUTINES;
}

/**
 * Everyone's launcher row for `today` (`dow` 1 = Monday). Options lead with
 * unfinished sessions to resume, then today's program day, the rest of the
 * program (the next not-done day of this program week first), other
 * routines, and care then core work last (both are also offered as
 * finishers). Anyone with something to resume, or a program day today they
 * haven't done yet, starts checked. On a day off the default is what's next
 * in their program — the first day of this program week not yet done, so a
 * missed Monday comes before Friday — and only without a program is it the
 * routine they did last.
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
    // Already trained today's program day: it stays listed, but the person
    // isn't pre-checked for a second go.
    const doneToday =
      todaysRoutine !== null &&
      data.sessions.some(
        (s) =>
          s.clientId === client.id &&
          s.status === "completed" &&
          s.date === today &&
          s.routineId === todaysRoutine.routineId,
      );
    const upNextId =
      !ended && (todaysRoutine === null || doneToday)
        ? (programWeekStatus(data, client.id, today)?.days.find((d) => !d.done && !d.isToday)?.routineId ?? null)
        : null;

    const programGroup = program && !ended ? program.name : null;
    const programRoutineIds = new Set(
      programGroup
        ? data.programDays.filter((d) => d.programId === program!.id).map((d) => d.routineId)
        : [],
    );
    const start = (routineId: string, assignmentId: string | null) =>
      planValue({ kind: "start", routineId, assignmentId });
    const warm = (routineId: string) => wantsBikeWarmup(data, routineId);
    const options: LauncherRow["options"] = [
      ...planned.map((s) => ({
        value: planValue({ kind: "resume", sessionId: s.id }),
        label: `Resume: ${routineName(s.routineId)} (${shortDayLabel(s.date, today)})`,
        group: "Resume",
        bikeWarmup: false,
      })),
      ...(todaysRoutine
        ? [
            {
              value: start(todaysRoutine.routineId, assignment?.id ?? null),
              label: `${routineName(todaysRoutine.routineId)} — ${doneToday ? "done today" : "today's program day"}`,
              group: programGroup ?? "Program",
              bikeWarmup: warm(todaysRoutine.routineId),
            },
          ]
        : []),
      ...routines
        .filter((r) => programRoutineIds.has(r.id) && r.id !== todaysRoutine?.routineId)
        // What's next in the program leads; the rest stay A–Z (stable sort).
        .sort((a, b) => Number(b.id === upNextId) - Number(a.id === upNextId))
        .map((r) => ({
          value: start(r.id, assignment?.id ?? null),
          label: r.id === upNextId ? `${r.name} — next up` : r.name,
          group: programGroup!,
          bikeWarmup: warm(r.id),
        })),
      // A–Z within each group (the sort is stable).
      ...routines
        .filter((r) => !programRoutineIds.has(r.id))
        .map((r) => ({ value: start(r.id, null), label: r.name, group: routineGroup(r), bikeWarmup: warm(r.id) }))
        .sort((a, b) => TAIL_GROUPS.indexOf(a.group) - TAIL_GROUPS.indexOf(b.group)),
    ];

    // Nothing to resume and no program day left today: default to what's
    // next in their program, else what they did last (program routines carry
    // the assignment in their value) rather than whichever routine sorts
    // first.
    const lastRoutineId = data.sessions
      .filter((s) => s.clientId === client.id && s.status === "completed" && s.routineId)
      .sort((a, b) => b.date.localeCompare(a.date))[0]?.routineId;
    const routineValue = (routineId: string | null | undefined) =>
      options.find((o) => {
        const plan = parsePlanValue(o.value);
        return plan?.kind === "start" && plan.routineId === routineId;
      })?.value;
    const fallback = options[0]?.value ?? "";
    const defaultPlan =
      planned.length > 0 || (todaysRoutine && !doneToday)
        ? fallback
        : (routineValue(upNextId) ?? routineValue(lastRoutineId) ?? fallback);

    return {
      clientId: client.id,
      firstName: client.firstName,
      color: client.color,
      options,
      defaultPlan,
      defaultChecked: planned.length > 0 || (todaysRoutine !== null && !doneToday),
      finishedProgram:
        ended && assignment && program
          ? { assignmentId: assignment.id, programName: program.name }
          : null,
      unfinished: planned.map((s) => ({ id: s.id, name: routineName(s.routineId), date: s.date })),
    };
  });
}

type Plans = Readonly<Record<string, string>>;

/** The Start button names what it will do: "Pick who's training", "Start
 *  Nate's workout", "Resume Nate's workout", "Start group workout (2)". */
export function startLabel(selected: readonly LauncherRow[], plans: Plans): string {
  if (selected.length === 0) return "Pick who's training";
  if (selected.length > 1) return `Start group workout (${selected.length})`;
  const [row] = selected;
  const verb = parsePlanValue(plans[row.clientId] ?? "")?.kind === "resume" ? "Resume" : "Start";
  return `${verb} ${row.firstName}'s workout`;
}

/** Whether to offer the bike warm-up checkbox: someone selected has chosen
 *  a lifting start (resumes, care and core work never warm up). */
export function warmupApplies(selected: readonly LauncherRow[], plans: Plans): boolean {
  return selected.some((r) => r.options.find((o) => o.value === plans[r.clientId])?.bikeWarmup);
}
