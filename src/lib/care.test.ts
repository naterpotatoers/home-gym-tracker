import { describe, expect, it } from "vitest";
import { isFinisherRoutine } from "./built-in-routines";
import { coreRotation, finisherGroups, finisherOptions, type FinisherOption } from "./care";
import { isCareRoutine } from "./data/care-routines";
import { isCoreRoutine } from "./data/core-routines";
import { seedSnapshot } from "./data/seed-snapshot";
import { buildGymData } from "./gym-data";

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

  it("lists every care and core routine once, suggestions first, without the prefix", () => {
    const out = finisherOptions(data, "s_nate_0715");
    const finishers = data.routines.filter(isFinisherRoutine).map((r) => r.id);
    expect(out.map((o) => o.id).sort()).toEqual([...finishers].sort());
    const firstPlain = out.findIndex((o) => !o.suggested);
    expect(out.slice(firstPlain).every((o) => !o.suggested)).toBe(true);
    expect(out.every((o) => !/^(care|core)\s*:/i.test(o.name))).toBe(true);
    expect(out.every((o) => o.prescriptions.length > 0)).toBe(true);
    expect(out.every((o) => o.minutes >= 1 && o.minutes <= 10)).toBe(true);
  });

  it("suggests one care match and one core finisher", () => {
    const out = finisherOptions(data, "s_nate_0715").filter((o) => o.suggested);
    expect(out.map((o) => o.kind)).toEqual(["care", "core"]);
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
    expect(ids.length).toBe(data.routines.filter(isFinisherRoutine).length - 1);
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

describe("coreRotation", () => {
  const core = data.routines.filter(isCoreRoutine);

  it("starts A–Z when nothing has been done", () => {
    expect(coreRotation(data, "nate").map((r) => r.id)).toEqual(
      [...core].sort((a, b) => a.name.localeCompare(b.name)).map((r) => r.id),
    );
  });

  it("moves a core finisher to the back once it's been done", () => {
    const first = coreRotation(data, "nate")[0];
    const session = data.sessions.find((s) => s.clientId === "nate" && s.status === "completed")!;
    const template = data.setsBySession.get(session.id)![0];
    const rows = data.exercisesByRoutine.get(first.id) ?? [];
    const withCore = {
      ...data,
      setsBySession: new Map([
        ...data.setsBySession,
        [
          session.id,
          [
            ...data.setsBySession.get(session.id)!,
            ...rows.map((rx, i) => ({
              ...template,
              id: `sl_core_${i}`,
              exerciseId: rx.exerciseId,
              modalityId: rx.modalityId,
              completed: true,
            })),
          ],
        ],
      ]),
    };
    const order = coreRotation(withCore, "nate").map((r) => r.id);
    expect(order.at(-1)).toBe(first.id);
    expect(order).toHaveLength(core.length);
  });
});

describe("finisherOptions with the bike warm-up", () => {
  it("still offers an Echo Bike finisher when the session opened on the bike", () => {
    const sessionId = "s_nate_0715";
    const template = data.setsBySession.get(sessionId)![0];
    const echoRow = {
      routineId: "r_echo",
      order: 1,
      exerciseId: "echo_bike",
      modalityId: "cardio" as const,
      bandRole: null,
      unilateralMode: "bilateral" as const,
      sets: 1,
      repMin: null,
      repMax: null,
      durationSeconds: 240,
      restSeconds: 60,
      targetRir: null,
      supersetGroup: null,
      notes: "",
      conditioning: { intervalScheme: "8x20/10", targetWatts: 200, targetRpm: null },
    };
    const withWarmup = buildGymData({
      ...data,
      routines: [...data.routines, { id: "r_echo", name: "Echo 20/10", notes: "" }],
      routineExercises: [...data.routineExercises, echoRow],
      setLogs: [
        ...data.setLogs,
        { ...template, id: "sl_warm", exerciseId: "echo_bike", modalityId: "cardio", isWarmup: true },
      ],
    });
    const ids = finisherOptions(withWarmup, sessionId).map((o) => o.id);
    expect(ids).toContain("r_echo");
  });
});


describe("finisherGroups (the continue prompt)", () => {
  const option = (id: string, kind: FinisherOption["kind"], suggested = false): FinisherOption => ({
    id,
    name: id,
    kind,
    suggested,
    minutes: 6,
    prescriptions: [],
  });

  it("suggested first with kind-tagged names, then care, core, conditioning untagged", () => {
    const groups = finisherGroups([
      option("Knee", "care", true),
      option("Obliques", "core", true),
      option("Echo 20/10", "conditioning"),
      option("Stability", "core"),
      option("Ankle", "care"),
    ]);
    expect(groups).toEqual([
      {
        label: "Suggested finishers",
        options: [
          { id: "Knee", text: "Care: Knee · ~6 min" },
          { id: "Obliques", text: "Core: Obliques · ~6 min" },
        ],
      },
      { label: "Care & mobility", options: [{ id: "Ankle", text: "Ankle · ~6 min" }] },
      { label: "Core", options: [{ id: "Stability", text: "Stability · ~6 min" }] },
      { label: "Conditioning", options: [{ id: "Echo 20/10", text: "Echo 20/10 · ~6 min" }] },
    ]);
  });

  it("drops empty groups", () => {
    expect(finisherGroups([option("Ankle", "care")]).map((g) => g.label)).toEqual(["Care & mobility"]);
    expect(finisherGroups([])).toEqual([]);
  });
});
