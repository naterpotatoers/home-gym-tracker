import { describe, expect, it } from "vitest";
import { seedSnapshot } from "./data/seed-snapshot";
import { variantKey } from "./exercise-catalog";
import { buildGymData } from "./gym-data";
import { livePerson } from "./live-session";
import type { Session, SetLog } from "./types";

const seed = seedSnapshot();

const session = (id: string, date: string, status: Session["status"]): Session => ({
  id,
  clientId: "gabriel",
  date,
  assignmentId: null,
  routineId: null,
  durationMinutes: null,
  rpe: null,
  condition: null,
  status,
  notes: "",
});

const deadlift = (sessionId: string, reps: number, completed = true, isWarmup = false): SetLog => ({
  id: `sl_${sessionId}`,
  sessionId,
  exerciseId: "deadlift",
  modalityId: "barbell",
  position: 1,
  setNumber: 1,
  unilateralMode: "bilateral",
  side: null,
  reps,
  weightLbs: 200,
  addedWeightLbs: null,
  bandId: null,
  bandRole: null,
  durationSeconds: null,
  distanceFeet: null,
  rir: 1,
  isWarmup,
  completed,
  notes: "",
  conditioning: null,
});

describe("livePerson stalls", () => {
  const dates = ["2026-10-20", "2026-10-27", "2026-11-03", "2026-11-10"];
  const history = dates.map((d, i) => session(`s_dl_${i}`, d, "completed"));
  const build = (status: Session["status"], isWarmup = false) =>
    buildGymData({
      ...seed,
      sessions: [...seed.sessions, ...history, session("s_today", "2026-11-17", status)],
      setLogs: [
        ...seed.setLogs,
        ...history.map((s) => deadlift(s.id, 5)),
        deadlift("s_today", 5, false, isWarmup),
      ],
    });

  it("flags a stalled lift in a planned session", () => {
    const data = build("planned");
    const person = livePerson(data, data.sessionById.get("s_today")!);
    expect(Object.keys(person.stalls)).toEqual([variantKey("deadlift", "barbell")]);
  });

  it("nothing once the session is completed, or for warm-up sets", () => {
    const done = build("completed");
    expect(livePerson(done, done.sessionById.get("s_today")!).stalls).toEqual({});
    const warm = build("planned", true);
    expect(livePerson(warm, warm.sessionById.get("s_today")!).stalls).toEqual({});
  });
});

describe("livePerson bike history", () => {
  it("carries the person's past bike pieces, this session's left out", () => {
    const bike = (sessionId: string, avgWatts: number): SetLog => ({
      ...deadlift(sessionId, 1),
      id: `sl_bike_${sessionId}`,
      exerciseId: "echo_bike",
      modalityId: "cardio",
      reps: null,
      weightLbs: null,
      rir: null,
      durationSeconds: 240,
      isWarmup: true,
      conditioning: {
        intervalScheme: "8x20/10",
        targetWatts: null,
        targetRpm: null,
        avgWatts,
        maxWatts: null,
        avgRpm: null,
        calories: null,
        effort: 6,
      },
    });
    const data = buildGymData({
      ...seed,
      sessions: [...seed.sessions, session("s_then", "2026-11-10", "completed"), session("s_now", "2026-11-17", "planned")],
      setLogs: [...seed.setLogs, bike("s_then", 150), bike("s_now", 160)],
    });
    expect(livePerson(data, data.sessionById.get("s_now")!).bikeHistory).toEqual([
      { sessionId: "s_then", setNumber: 1, shape: "8x20/10", warmup: true, date: "2026-11-10", avgWatts: 150, effort: 6 },
    ]);
  });
});
