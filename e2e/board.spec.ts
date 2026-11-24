import { expect, test } from "./fixtures";
import { plannedSessionId, sessionsOf, setsOf } from "./support/db";
import { watchSetSaveResponses } from "./support/network";

/** A set save must not carry a re-rendered page back (the original "stuck
 *  board" bug: every save revalidated and shipped the whole board). */
const MAX_SAVE_RESPONSE_BYTES = 5_000;

test("group board: log, swap, skip, remove and finish across three people", async ({
  world,
  launcher,
  card,
  page,
}) => {
  const { alpha, beta, gamma } = world;
  await launcher.start([alpha, beta, gamma], { routine: world.routine.name, warmup: false });
  const [alphaId, betaId, gammaId] = await Promise.all(
    [alpha, beta, gamma].map((p) => plannedSessionId(p.id)),
  );

  // Watch every set save while people log (finish is excluded: it
  // revalidates on purpose).
  const saves = watchSetSaveResponses(page);

  const a = card(alpha.firstName);
  const b = card(beta.firstName);
  const g = card(gamma.firstName);
  const squat = world.name("squat");
  const bench = world.name("bench_press");

  await test.step("quick logs on two cards land in the database", async () => {
    await a.expectCurrent(squat);
    await a.logCurrent(2);
    await b.logCurrent(1);
    await expect.poll(async () => (await setsOf(alphaId!)).filter((s) => s.completed).length).toBe(2);
    await expect.poll(async () => (await setsOf(betaId!)).filter((s) => s.completed).length).toBe(1);
  });

  await test.step("swap lands on the card and in the database", async () => {
    const goblet = world.name("goblet_squat");
    await g.current.swapTo(goblet);
    await g.expectCurrent(goblet);
    await expect
      .poll(async () => (await setsOf(gammaId!)).filter((s) => s.exercise_id === "goblet_squat").length)
      .toBe(3);
  });

  await test.step("skip moves the cursor; remove goes through the dialog", async () => {
    await g.current.skip();
    await g.expectCurrent(bench);
    await g.current.remove();
    await expect(g.block(bench).root).toHaveCount(0);
    await expect
      .poll(async () => (await setsOf(gammaId!)).some((s) => s.exercise_id === "bench_press"))
      .toBe(false);
  });

  await test.step("set saves stay small (no page re-render inside a save)", async () => {
    const sizes = await saves.stop();
    expect(sizes.length).toBeGreaterThan(0);
    expect(Math.max(...sizes)).toBeLessThan(MAX_SAVE_RESPONSE_BYTES);
  });

  await test.step("two people finish; their cards show the recap link", async () => {
    await a.finish({ rpe: 8 });
    await expect(a.recapLink).toBeVisible();
    await b.finish({ rpe: 6 });
    await expect(b.recapLink).toBeVisible();
    await expect(g.current.root).toBeVisible(); // Gamma is still going
    const status = async (clientId: string) => (await sessionsOf(clientId))[0]?.status;
    await expect.poll(() => status(alpha.id)).toBe("completed");
    await expect.poll(() => status(beta.id)).toBe("completed");
    expect(await status(gamma.id)).toBe("planned");
  });
});
