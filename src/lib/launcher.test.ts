import { describe, expect, it } from "vitest";
import { seedSnapshot } from "./data/seed-snapshot";
import {
  type LauncherRow,
  launcherRows,
  parsePlanValue,
  planValue,
  routineGroup,
  startLabel,
  warmupApplies,
  type Plan,
} from "./launcher";
import { buildGymData } from "./gym-data";
import { plannedSessionFromRoutine } from "./planning";
import type { Session } from "./types";

describe("plan values (the launcher ↔ startGroupFromForm contract)", () => {
  it("round-trips every plan shape", () => {
    const plans: Plan[] = [
      { kind: "resume", sessionId: "s_abc" },
      { kind: "start", routineId: "r_full_a", assignmentId: "a_1" },
      { kind: "start", routineId: "r_full_a", assignmentId: null },
    ];
    for (const plan of plans) expect(parsePlanValue(planValue(plan))).toEqual(plan);
  });
  it("rejects what planValue can't produce", () => {
    expect(parsePlanValue("resume:")).toBeNull();
    expect(parsePlanValue("r_full_a")).toBeNull();
    expect(parsePlanValue("|a_1")).toBeNull();
    expect(parsePlanValue("a|b|c")).toBeNull();
  });
});

describe("launcherRows", () => {
  const data = seedSnapshot();
  const today = "2026-11-16";
  const rows = launcherRows(data, today, 1);

  it("has one row per client, every option parseable, default among options", () => {
    expect(rows.map((r) => r.clientId)).toEqual(data.clients.map((c) => c.id));
    for (const row of rows) {
      for (const o of row.options) expect(parsePlanValue(o.value)).not.toBeNull();
      if (row.options.length > 0) {
        expect(row.options.map((o) => o.value)).toContain(row.defaultPlan);
      }
    }
  });

  it("resume options lead and only carry the person's own sessions", () => {
    for (const row of rows) {
      const resumes = row.options.filter((o) => parsePlanValue(o.value)?.kind === "resume");
      expect(row.options.slice(0, resumes.length)).toEqual(resumes);
      if (resumes.length > 0) expect(row.defaultChecked).toBe(true);
      for (const o of resumes) {
        const plan = parsePlanValue(o.value) as Extract<Plan, { kind: "resume" }>;
        expect(data.sessionById.get(plan.sessionId)?.clientId).toBe(row.clientId);
      }
    }
  });

  it("offers the bike warm-up on lifting starts only", () => {
    for (const row of rows) {
      for (const option of row.options) {
        const plan = parsePlanValue(option.value);
        if (plan?.kind !== "start") {
          expect(option.bikeWarmup).toBe(false);
          continue;
        }
        const routine = data.routineById.get(plan.routineId)!;
        if (/^(care|core)\s*:/i.test(routine.name)) expect(option.bikeWarmup, routine.id).toBe(false);
      }
      expect(row.options.some((o) => o.bikeWarmup)).toBe(true);
    }
  });

  it("care then core routines sit in their own trailing groups", () => {
    for (const row of rows) {
      const groups = row.options.map((o) => o.group);
      const firstCare = groups.indexOf("Care & mobility");
      if (firstCare >= 0) {
        expect(groups.slice(firstCare).every((g) => g === "Care & mobility" || g === "Core")).toBe(true);
      }
      const firstCore = groups.indexOf("Core");
      expect(firstCore).toBeGreaterThan(-1);
      expect(groups.slice(firstCore).every((g) => g === "Core")).toBe(true);
      expect(groups.filter((g) => g === "Other routines").length).toBeGreaterThan(0);
    }
  });

  it("routineGroup: care and core by id or name prefix, everything else Other", () => {
    expect(routineGroup({ id: "r_knee_care", name: "Knee" })).toBe("Care & mobility");
    expect(routineGroup({ id: "r_x", name: "Core: Planks" })).toBe("Core");
    expect(routineGroup({ id: "r_echo", name: "Echo 20/10" })).toBe("Other routines");
  });

  it("each trailing group stays A–Z", () => {
    for (const row of rows) {
      for (const group of ["Other routines", "Care & mobility", "Core"]) {
        const labels = row.options.filter((o) => o.group === group).map((o) => o.label);
        expect(labels).toEqual([...labels].sort((a, b) => a.localeCompare(b)));
      }
    }
  });
});

describe("plannedSessionFromRoutine ownership", () => {
  const data = seedSnapshot();
  const assignment = data.assignments[0];
  const routineId = data.exercisesByRoutine.keys().next().value!;
  const other = data.clients.find((c) => c.id !== assignment.clientId)!;

  it("refuses someone else's assignment and unknown routines", () => {
    expect(() => plannedSessionFromRoutine(data, other.id, routineId, assignment.id, "2026-11-16")).toThrow(
      /bad assignment/,
    );
    expect(() => plannedSessionFromRoutine(data, other.id, "r_nope", null, "2026-11-16")).toThrow();
  });
  it("accepts the owner's assignment", () => {
    const { session } = plannedSessionFromRoutine(data, assignment.clientId, routineId, assignment.id, "2026-11-16");
    expect(session.assignmentId).toBe(assignment.id);
  });
});

describe("the Start button and warm-up checkbox", () => {
  const lift = planValue({ kind: "start", routineId: "r_full_a", assignmentId: null });
  const care = planValue({ kind: "start", routineId: "r_knee_care", assignmentId: null });
  const resume = planValue({ kind: "resume", sessionId: "s_1" });
  const row = (clientId: string, firstName: string): LauncherRow => ({
    clientId,
    firstName,
    color: null,
    options: [
      { value: lift, label: "Full A", group: "Other routines", bikeWarmup: true },
      { value: care, label: "Knee", group: "Care & mobility", bikeWarmup: false },
      { value: resume, label: "Resume", group: "Resume", bikeWarmup: false },
    ],
    defaultPlan: lift,
    defaultChecked: true,
    unfinished: [],
    finishedProgram: null,
  });
  const nate = row("nate", "Nate");
  const lidia = row("lidia", "Lidia");

  it("names what it will do", () => {
    expect(startLabel([], {})).toBe("Pick who's training");
    expect(startLabel([nate], { nate: lift })).toBe("Start Nate's workout");
    expect(startLabel([nate], { nate: resume })).toBe("Resume Nate's workout");
    expect(startLabel([nate, lidia], { nate: lift, lidia: care })).toBe("Start group workout (2)");
  });

  it("offers the warm-up when anyone selected starts a lift", () => {
    expect(warmupApplies([nate], { nate: lift })).toBe(true);
    expect(warmupApplies([nate], { nate: care })).toBe(false);
    expect(warmupApplies([nate], { nate: resume })).toBe(false);
    expect(warmupApplies([nate, lidia], { nate: care, lidia: lift })).toBe(true);
    expect(warmupApplies([], {})).toBe(false);
  });
});

describe("the default plan follows the program", () => {
  const seed = seedSnapshot();
  // Lidia: Foundations from Mon 2026-07-06 — Mondays r_full_a, Thursdays
  // r_full_b. Her seed history is swapped for exactly what each case needs.
  const done = (date: string, routineId: string): Session => ({
    id: `s_${date}_${routineId}`,
    clientId: "lidia",
    date,
    assignmentId: null,
    routineId,
    durationMinutes: null,
    rpe: null,
    condition: null,
    status: "completed",
    notes: "",
  });
  const lidia = (today: string, dow: number, sessions: Session[]) => {
    const data = buildGymData({
      ...seed,
      sessions: [...seed.sessions.filter((s) => s.clientId !== "lidia"), ...sessions],
    });
    const row = launcherRows(data, today, dow).find((r) => r.clientId === "lidia")!;
    return { row, picked: row.options.find((o) => o.value === row.defaultPlan)! };
  };
  const routineOf = (value: string) => (parsePlanValue(value) as Extract<Plan, { kind: "start" }>).routineId;

  it("a program day not yet done: pre-checked, today's day picked", () => {
    const { row, picked } = lidia("2026-07-13", 1, []);
    expect(row.defaultChecked).toBe(true);
    expect(picked.label).toMatch(/today's program day$/);
    expect(routineOf(picked.value)).toBe("r_full_a");
  });

  it("a day off: what's next in the program, not the routine done last", () => {
    // Tuesday; Monday's day was missed and her last session was something else.
    const { row, picked } = lidia("2026-07-14", 2, [done("2026-07-10", "r_lower")]);
    expect(row.defaultChecked).toBe(false);
    expect(routineOf(picked.value)).toBe("r_full_a");
    expect(picked.label).toMatch(/next up$/);
    // Carries the assignment, so the session counts toward the program.
    expect(parsePlanValue(picked.value)).toMatchObject({ assignmentId: "a_lidia_foundations" });
  });

  it("a day off after Monday's is done: Thursday's is next", () => {
    const { picked } = lidia("2026-07-14", 2, [done("2026-07-13", "r_full_a")]);
    expect(routineOf(picked.value)).toBe("r_full_b");
  });

  it("today's program day already done today: not pre-checked, the next one picked", () => {
    const { row, picked } = lidia("2026-07-13", 1, [done("2026-07-13", "r_full_a")]);
    expect(row.defaultChecked).toBe(false);
    expect(row.options.some((o) => /done today$/.test(o.label))).toBe(true);
    expect(routineOf(picked.value)).toBe("r_full_b");
  });

  it("the whole program week done, or no program: the routine done last", () => {
    const week = [done("2026-07-13", "r_full_a"), done("2026-07-16", "r_full_b")];
    expect(routineOf(lidia("2026-07-17", 5, week).picked.value)).toBe("r_full_b");
    const data = buildGymData({
      ...seed,
      assignments: seed.assignments.filter((a) => a.clientId !== "lidia"),
      sessions: [...seed.sessions.filter((s) => s.clientId !== "lidia"), done("2026-07-10", "r_lower")],
    });
    const row = launcherRows(data, "2026-07-14", 2).find((r) => r.clientId === "lidia")!;
    expect(routineOf(row.defaultPlan)).toBe("r_lower");
  });
});
