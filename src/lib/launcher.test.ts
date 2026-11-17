import { describe, expect, it } from "vitest";
import { seedSnapshot } from "./data/seed-snapshot";
import { launcherRows, parsePlanValue, planValue, type Plan } from "./launcher";
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

  it("care routines sit in their own trailing group", () => {
    for (const row of rows) {
      const groups = row.options.map((o) => o.group);
      const firstCare = groups.indexOf("Care & mobility");
      if (firstCare >= 0) expect(groups.slice(firstCare).every((g) => g === "Care & mobility")).toBe(true);
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
