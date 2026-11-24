import { expect, test as base } from "@playwright/test";
import { Launcher } from "./pages/launcher";
import { PersonCard, SoloRunner } from "./pages/session";
import { createWorld, destroyWorld, type World } from "./support/world";

/**
 * Every test gets its own world (fresh e2e people, routine, history) that is
 * deleted afterwards whether the test passed or not, plus the page objects.
 * Import `test`/`expect` from here, never from @playwright/test, in specs.
 */
export const test = base.extend<{
  world: World;
  launcher: Launcher;
  runner: SoloRunner;
  card: (firstName: string) => PersonCard;
}>({
  // Own timeout, so setup/cleanup never eats the test's budget and a slow
  // test still gets its rows deleted.
  world: [
    async ({}, use) => {
      const world = await createWorld();
      try {
        await use(world);
      } finally {
        await destroyWorld(world);
      }
    },
    { timeout: 30_000 },
  ],
  launcher: async ({ page }, use) => use(new Launcher(page)),
  runner: async ({ page }, use) => use(new SoloRunner(page)),
  card: async ({ page }, use) => use((firstName) => new PersonCard(page, firstName)),
});

export { expect };
