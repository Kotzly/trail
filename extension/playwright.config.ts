import { defineConfig, devices } from "@playwright/test";
import { resolve } from "node:path";

/**
 * Playwright config for MV3 extension smoke tests.
 *
 * The extension is loaded through a persistent context (see
 * `tests/e2e/fixtures.ts`) using the built `dist/chrome-mv3`
 * directory. `pnpm build` must run before `pnpm e2e`.
 */
export default defineConfig({
  testDir: resolve(__dirname, "tests/e2e"),
  fullyParallel: false, // extension context is shared
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? [["github"], ["list"]] : "list",
  timeout: 30_000,
  use: {
    ...devices["Desktop Chrome"],
    trace: "on-first-retry",
    video: process.env.CI ? "retain-on-failure" : "off",
  },
});
