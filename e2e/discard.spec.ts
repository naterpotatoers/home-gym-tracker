import { expect, test } from "./fixtures";
import { plannedSessionId, sessionsOf } from "./support/db";

test("discarding a solo session deletes it and returns home", async ({ world, launcher, runner, page }) => {
  await launcher.start([world.alpha], { routine: world.routine.name, warmup: false });
  const sessionId = await plannedSessionId(world.alpha.id);
  await runner.logCurrent(1);

  await runner.discard();

  await expect(page).toHaveURL(/\/$/);
  await expect.poll(async () => (await sessionsOf(world.alpha.id)).some((s) => s.id === sessionId)).toBe(false);
  // Home is clean: nothing for Alpha to resume.
  await expect(page.getByRole("combobox", { name: `${world.alpha.firstName}'s plan` })).not.toContainText(
    "Resume",
  );
});
