import { expect, test } from "./fixtures";
import { plannedSessionId, sessionsOf, setsOf } from "./support/db";

test.describe("bike warm-up", () => {
  test("skip warm-up takes it out of the session", async ({ world, launcher, runner }) => {
    await launcher.start([world.alpha], { routine: world.routine.name, warmup: true });
    const sessionId = (await plannedSessionId(world.alpha.id))!;
    const bike = world.name("echo_bike");

    await runner.expectCurrent(bike);
    await runner.current.skip();
    await runner.expectCurrent(world.name("squat"));
    await expect(runner.block(bike).root).toHaveCount(0);
    await expect
      .poll(async () => (await setsOf(sessionId)).some((s) => s.exercise_id === "echo_bike"))
      .toBe(false);
  });

  test("an unlogged warm-up is dropped at finish; positions stay contiguous", async ({
    world,
    launcher,
    runner,
  }) => {
    await launcher.start([world.beta], { routine: world.routine.name, warmup: true });
    const sessionId = (await plannedSessionId(world.beta.id))!;

    await runner.block(world.name("squat")).open(); // jump past the warm-up
    await runner.expectCurrent(world.name("squat"));
    await runner.logCurrent(1);
    await runner.finish({ rpe: 5 });

    await expect.poll(async () => (await sessionsOf(world.beta.id))[0]?.status).toBe("completed");
    const sets = await setsOf(sessionId);
    expect(sets.some((s) => s.exercise_id === "echo_bike")).toBe(false);
    expect(sets.map((s) => s.position)).toEqual(sets.map((_, i) => i + 1));
  });
});
