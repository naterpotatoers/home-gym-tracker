import { expect, test } from "./fixtures";
import { plannedSessionId, sessionsOf, setsOf } from "./support/db";

test("solo workout: warm-up readout, last-time pre-fill, skip, superset, finish", async ({
  world,
  launcher,
  runner,
}) => {
  const { alpha } = world;
  await launcher.start([alpha], { routine: world.routine.name, warmup: true });
  const sessionId = await plannedSessionId(alpha.id);
  expect(sessionId).not.toBeNull();

  await test.step("bike warm-up carries last time's target and saves the readout", async () => {
    await runner.expectCurrent(world.name("echo_bike"));
    await expect(runner.current.targetWatts).toHaveValue("150");
    await runner.current.fillBike({ avgWatts: 171, maxWatts: 310, avgRpm: 61, calories: 33, effort: 6 });
    await runner.current.log();
  });

  await test.step("squat pre-fills last time's top set, not the drop set", async () => {
    await runner.expectCurrent(world.name("squat"));
    await expect(runner.current.weight).toHaveValue("100");
    await runner.logCurrent(3);
  });

  await test.step("skipping bench moves on to the superset", async () => {
    await runner.expectCurrent(world.name("bench_press"));
    await runner.current.skip();
    await runner.expectCurrent(world.name("pull_up"));
    await runner.current.log();
    await runner.expectCurrent(world.name("calf_raise")); // superset partner is next
  });

  await runner.finish({ rpe: 7 });

  await test.step("everything is in the database", async () => {
    await expect.poll(async () => (await sessionsOf(alpha.id)).find((s) => s.id === sessionId)?.status).toBe(
      "completed",
    );
    const sets = await setsOf(sessionId!);
    const bike = sets.find((s) => s.exercise_id === "echo_bike");
    expect(bike).toMatchObject({ completed: true, is_warmup: true, avg_watts: 171, max_watts: 310, effort: 6 });
    const squats = sets.filter((s) => s.exercise_id === "squat" && s.completed);
    expect(squats.map((s) => s.weight_lbs)).toEqual([100, 100, 100]);
    expect(sets.map((s) => s.position)).toEqual(sets.map((_, i) => i + 1));
  });
});
