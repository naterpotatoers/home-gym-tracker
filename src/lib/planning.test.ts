import { describe, expect, it } from "vitest";
import { seedSnapshot } from "./data/seed-snapshot";
import { plannedSessionFromRoutine, programWeekStatus, smartPrefill } from "./planning";
import type { RoutineExercise, Session } from "./types";

const data = seedSnapshot();
const TODAY = "2026-08-02";

function rx(overrides: Partial<RoutineExercise>): RoutineExercise {
  return {
    routineId: "r_test",
    order: 1,
    exerciseId: "bench_press",
    modalityId: "barbell",
    bandRole: null,
    unilateralMode: "bilateral",
    sets: 3,
    repMin: 10,
    repMax: 10,
    durationSeconds: null,
    restSeconds: 90,
    targetRir: 2,
    supersetGroup: null,
    notes: "",
    ...overrides,
  };
}

describe("smartPrefill priority chain (pinned against seed data)", () => {
  it("tier 1: last working weight at the prescribed rep range", () => {
    const result = smartPrefill(data, "nate", rx({}), TODAY);
    expect(result?.weightLbs).toBe(145); // Nate's last 10-rep barbell bench set
  });

  it("tier 1 covers dumbbell history verbatim", () => {
    const result = smartPrefill(data, "nate", rx({ modalityId: "dumbbell" }), TODAY);
    expect(result?.weightLbs).toBe(50);
  });

  it("tier 3: cross-modality transfer snaps to owned equipment", () => {
    // Nate has never done dumbbell deadlifts; barbell strength transfers but
    // must snap to the heaviest owned pair (50s).
    const result = smartPrefill(
      data,
      "nate",
      rx({ exerciseId: "deadlift", modalityId: "dumbbell" }),
      TODAY,
    );
    expect(result?.weightLbs).toBe(50);
  });

  it("tier 4: never-done-anywhere stays blank", () => {
    const result = smartPrefill(
      data,
      "nate",
      rx({ exerciseId: "woodchopper", modalityId: "band", bandRole: "resistance", unilateralMode: "single_side" }),
      TODAY,
    );
    expect(result).toBeNull();
  });

  it("band history carries the band, never a fabricated pound value", () => {
    const result = smartPrefill(
      data,
      "lidia",
      rx({ exerciseId: "pull_up", modalityId: "band", bandRole: "assistance", repMin: 6, repMax: 6 }),
      TODAY,
    );
    expect(result?.bandId).toBe("band_blue");
    expect(result?.weightLbs).toBeNull();
  });

  it("never transfers INTO band work", () => {
    // Even with lat strength from pull-ups, a band-modality prescription with
    // no band history must not get invented numbers.
    const result = smartPrefill(
      data,
      "nate",
      rx({ exerciseId: "chest_fly", modalityId: "band", bandRole: "resistance" }),
      TODAY,
    );
    // Nate has dumbbell chest fly history at most — result is either null or
    // band-only fields; assert no pound value in every case.
    expect(result?.weightLbs ?? null).toBeNull();
  });
});

describe("plannedSessionFromRoutine", () => {
  it("creates one set per prescribed set with contiguous positions", () => {
    const routineId = data.routines[0].id;
    const prescriptions = data.exercisesByRoutine.get(routineId) ?? [];
    const expected = prescriptions.reduce((n, p) => n + p.sets, 0);
    const { sets } = plannedSessionFromRoutine(data, "nate", routineId, null, TODAY);
    expect(sets).toHaveLength(expected);
    expect(sets.map((s) => s.position)).toEqual(sets.map((_, i) => i + 1));
    expect(sets.every((s) => !s.completed && !s.isWarmup)).toBe(true);
  });

  it("throws on an empty routine", () => {
    expect(() =>
      plannedSessionFromRoutine(data, "nate", "r_does_not_exist", null, TODAY),
    ).toThrow("Routine has no exercises.");
  });
});

describe("programWeekStatus", () => {
  const base = data.sessions[0];
  const completed = (date: string, routineId: string): Session => ({
    ...base,
    id: `s_${date}_${routineId}`,
    clientId: "nate",
    date,
    routineId,
    status: "completed",
  });

  it("matches one completed session to one scheduled day", () => {
    // Nate's Upper/Lower starts Mon 2026-06-15; Lower is Tue + Fri.
    const status = programWeekStatus(
      { ...data, sessions: [completed("2026-06-16", "r_lower")] },
      "nate",
      "2026-06-19",
    )!;
    expect(status.week).toBe(1);
    expect(status.finished).toBe(false);
    const lower = status.days.filter((d) => d.routineId === "r_lower");
    expect(lower.map((d) => [d.date, d.done])).toEqual([
      ["2026-06-16", true],
      ["2026-06-19", false],
    ]);
    expect(status.days.find((d) => d.isToday)?.date).toBe("2026-06-19");
  });

  it("ticks both days once two sessions exist", () => {
    const status = programWeekStatus(
      {
        ...data,
        sessions: [completed("2026-06-16", "r_lower"), completed("2026-06-19", "r_lower")],
      },
      "nate",
      "2026-06-20",
    )!;
    expect(status.days.filter((d) => d.done)).toHaveLength(2);
  });

  it("is finished past the program's last week", () => {
    // 8 weeks from 2026-06-15 ends before 2026-08-10.
    expect(programWeekStatus(data, "nate", "2026-08-09")!.finished).toBe(false);
    expect(programWeekStatus(data, "nate", "2026-08-10")!.finished).toBe(true);
  });

  it("is null without an active assignment", () => {
    expect(programWeekStatus({ ...data, assignments: [] }, "nate", TODAY)).toBeNull();
  });
});
