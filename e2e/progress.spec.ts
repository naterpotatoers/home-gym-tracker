import { expect, test } from "./fixtures";

test("a stalled lift shows a terse chip and pre-fills last time's weight — no suggestion", async ({
  world,
  launcher,
  runner,
  page,
}) => {
  await launcher.start([world.beta], { routine: world.routine.name, warmup: false });
  const bench = runner.block(world.name("bench_press"));

  await expect(bench.root).toContainText(/stalled \d+ wk/);
  await expect(runner.block(world.name("squat")).root).not.toContainText(/stalled/);

  await runner.current.skip(); // squat → bench
  await runner.expectCurrent(world.name("bench_press"));
  await expect(runner.current.weight).toHaveValue("95");
  // The old "try 100 lb" style recommendation is gone for good.
  await expect(page.getByText(/\btry\b[^.]*\d+\s*lb/i)).toHaveCount(0);
});
