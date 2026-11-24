import { existsSync } from "node:fs";
import { defineConfig, devices } from "@playwright/test";

// Locally the Supabase keys come from .env.local; in CI from repo secrets.
if (existsSync(".env.local")) process.loadEnvFile(".env.local");

const CI = !!process.env.CI;
const PORT = 3100;
/** Point at an already-running server (e.g. `E2E_BASE_URL=http://localhost:3000`
 *  for the dev server) instead of building and starting one. */
const external = process.env.E2E_BASE_URL;

/**
 * End-to-end tests for the live workout flows, run against the LIVE Supabase
 * DB with throwaway "E2E" people (see e2e/support/world.ts). One worker:
 * the tests share one database and one launcher roster.
 */
export default defineConfig({
  testDir: "e2e",
  globalSetup: "./e2e/global-setup.ts",
  fullyParallel: false,
  workers: 1,
  forbidOnly: CI,
  retries: CI ? 1 : 0,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: CI ? [["github"], ["html", { open: "never" }]] : [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: external ?? `http://localhost:${PORT}`,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    {
      // The gym's real device: an iPad in landscape, every flow.
      name: "ipad-landscape",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1180, height: 820 },
        hasTouch: true,
      },
    },
    {
      // A phone for the solo flow (cards stack, nav moves to the bottom).
      name: "phone",
      use: { ...devices["Pixel 7"] },
      testMatch: /solo\.spec\.ts/,
    },
  ],
  webServer: external
    ? undefined
    : {
        command: `npm run build && npm run start -- -p ${PORT}`,
        url: `http://localhost:${PORT}`,
        reuseExistingServer: !CI,
        timeout: 240_000,
      },
});
