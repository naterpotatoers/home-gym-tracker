import { describe, expect, it } from "vitest";
import { finisherOptions } from "./care";
import { isCareRoutine } from "./data/care-routines";
import { seedSnapshot } from "./data/seed-snapshot";

const data = seedSnapshot();
const LEGS = ["r_knee_care", "r_hip_glute_care", "r_achilles_hamstring_care", "r_low_back_care"];
const UPPER = ["r_shoulder_care", "r_posture_care"];

describe("isCareRoutine", () => {
  it("matches the built-ins by id and hand-made ones by name", () => {
    expect(isCareRoutine({ id: "r_knee_care", name: "Knee" })).toBe(true);
    expect(isCareRoutine({ id: "r_custom", name: "Care: Wrists" })).toBe(true);
    expect(isCareRoutine({ id: "r_upper", name: "Upper A" })).toBe(false);
  });
});

describe("finisherOptions", () => {
  const suggestedIds = (sessionId: string) =>
    finisherOptions(data, sessionId)
      .filter((o) => o.suggested)
      .map((o) => o.id);

  it("suggests lower-body care for a lower session", () => {
    const out = suggestedIds("s_nate_0715");
    expect(out.length).toBeGreaterThan(0);
    expect(LEGS).toContain(out[0]);
  });

  it("suggests upper-body care for an upper session", () => {
    const out = suggestedIds("s_nate_0727");
    expect(out.length).toBeGreaterThan(0);
    expect(UPPER).toContain(out[0]);
  });

  it("lists every care routine once, suggestions first, without the Care: prefix", () => {
    const out = finisherOptions(data, "s_nate_0715");
    const care = data.routines.filter(isCareRoutine).map((r) => r.id);
    expect(out.map((o) => o.id).sort()).toEqual([...care].sort());
    const firstPlain = out.findIndex((o) => !o.suggested);
    expect(out.slice(firstPlain).every((o) => !o.suggested)).toBe(true);
    expect(out.every((o) => !/^care\s*:/i.test(o.name))).toBe(true);
    expect(out.every((o) => o.prescriptions.length > 0)).toBe(true);
  });

  it("ranks on the whole plan, not just logged sets", () => {
    const session = data.sessions.find((s) => s.id === "s_nate_0715")!;
    const planned = {
      ...data,
      setsBySession: new Map([
        ...data.setsBySession,
        [session.id, (data.setsBySession.get(session.id) ?? []).map((s) => ({ ...s, completed: false }))],
      ]),
    };
    expect(finisherOptions(planned, session.id).some((o) => o.suggested)).toBe(true);
  });

  it("drops a finisher once all its exercises are in the session", () => {
    const sessionId = "s_nate_0715";
    const knee = data.exercisesByRoutine.get("r_knee_care") ?? [];
    const template = data.setsBySession.get(sessionId)![0];
    const withKnee = {
      ...data,
      setsBySession: new Map([
        ...data.setsBySession,
        [
          sessionId,
          [
            ...data.setsBySession.get(sessionId)!,
            ...knee.map((rx, i) => ({
              ...template,
              id: `sl_knee_${i}`,
              exerciseId: rx.exerciseId,
              modalityId: rx.modalityId,
            })),
          ],
        ],
      ]),
    };
    const ids = finisherOptions(withKnee, sessionId).map((o) => o.id);
    expect(ids).not.toContain("r_knee_care");
    expect(ids.length).toBe(data.routines.filter(isCareRoutine).length - 1);
  });

  it("offers nothing during a care session or for an unknown one", () => {
    const careSession = data.sessions.find((s) => {
      const routine = s.routineId ? data.routineById.get(s.routineId) : undefined;
      return routine !== undefined && isCareRoutine(routine);
    });
    if (careSession) expect(finisherOptions(data, careSession.id)).toEqual([]);
    expect(finisherOptions(data, "nope")).toEqual([]);
  });
});
