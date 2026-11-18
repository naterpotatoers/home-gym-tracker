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
import { plannedSessionFromRoutine } from "./planning";

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
