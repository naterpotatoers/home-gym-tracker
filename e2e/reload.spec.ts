import { expect, test } from "./fixtures";
import { plannedSessionId, setsOf } from "./support/db";
import { holdSetSaves } from "./support/network";

test.describe("a reload never loses work", () => {
  test("a bike readout whose save never landed is restored and saved", async ({ world, launcher, runner, page }) => {
    await launcher.start([world.alpha], { routine: world.routine.name, warmup: true });
    const sessionId = (await plannedSessionId(world.alpha.id))!;

    const saves = await holdSetSaves(page);
    await runner.current.fillBike({ avgWatts: 201, calories: 29 });
    await expect.poll(() => saves.count).toBeGreaterThan(0); // the save was attempted, and is stuck
    saves.stopHolding();
    await page.reload();

    await expect(runner.current.readout("avg watts")).toHaveValue("201");
    await expect
      .poll(async () => (await setsOf(sessionId)).find((s) => s.exercise_id === "echo_bike")?.avg_watts)
      .toBe(201);
  });

  test("an exercise added just before a reload is still there", async ({ world, launcher, runner, page }) => {
    await launcher.start([world.alpha], { routine: world.routine.name, warmup: false });
    const sessionId = (await plannedSessionId(world.alpha.id))!;
    const pushUp = world.name("push_up");

    const saves = await holdSetSaves(page);
    await runner.addExercise(pushUp);
    await expect.poll(() => saves.count).toBeGreaterThan(0);
    saves.stopHolding();
    await page.reload();

    await expect
      .poll(async () => (await setsOf(sessionId)).filter((s) => s.exercise_id === "push_up").length)
      .toBeGreaterThan(0);
    const positions = (await setsOf(sessionId)).map((s) => s.position);
    expect(positions).toEqual(positions.map((_, i) => i + 1));
  });
});
