import { expect, test } from "./fixtures";
import { plannedSessionId, setsOf } from "./support/db";

test("bike: a custom interval and a new target reach the pieces still to ride; readouts stay put", async ({
  world,
  launcher,
  runner,
}) => {
  const { alpha } = world;
  await launcher.start([alpha], { routine: world.routine.name, warmup: true });
  const sessionId = await plannedSessionId(alpha.id);
  expect(sessionId).not.toBeNull();
  const bikeSets = async () => (await setsOf(sessionId!)).filter((s) => s.exercise_id === "echo_bike");

  await runner.expectCurrent(world.name("echo_bike"));
  const bike = runner.current;
  await bike.addPiece();
  await expect.poll(async () => (await bikeSets()).length).toBe(2);

  await test.step("plan piece 1: 10 rounds of 30/30 at 180 W", async () => {
    await bike.customInterval({ rounds: 10, work: 30, rest: 30 });
    await bike.targetWatts.fill("180");
    await expect(bike.piece(2)).toHaveAccessibleName(/10 × 30\/30.*180 W/);
  });

  await test.step("what the console read belongs to piece 1 only", async () => {
    await bike.fillBike({ avgWatts: 171, distanceMi: 0.9 });
    await expect
      .poll(async () =>
        (await bikeSets()).map((s) => ({
          scheme: s.interval_scheme,
          seconds: s.duration_seconds,
          target: s.target_watts,
          avg: s.avg_watts,
          feet: s.distance_feet,
        })),
      )
      .toEqual([
        { scheme: "10x30/30", seconds: 600, target: 180, avg: 171, feet: 4752 },
        { scheme: "10x30/30", seconds: 600, target: 180, avg: null, feet: null },
      ]);
  });
});
