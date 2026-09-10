import { defineConfig, devices } from "@playwright/test";
import { config } from "dotenv";

// The Next.js server reads .env.local on its own; the test process does not,
// and it needs the same variables to know whether a database is reachable.
config({ path: ".env.local", quiet: true });

/**
 * End-to-end suite.
 *
 * These tests drive the real app against a real Supabase project — the point
 * is to exercise the migrated data and the forced password change, and a
 * stubbed database would prove neither. Point `.env.local` at the project,
 * apply `db/schema.sql`, run `npm run db:seed:e2e`, then `npm run test:e2e`.
 *
 * Without `SUPABASE_URL` the suite reports as skipped rather than failing, so
 * `npm test && npm run test:e2e` is safe on a machine with no credentials.
 */

/**
 * Without credentials every spec skips, and the dev server would 500 on the
 * first page it rendered — so there is nothing to start.
 */
const configured = Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);

const PORT = Number(process.env.E2E_PORT ?? 3100);
// `localhost`, not `127.0.0.1`: `next dev` binds localhost and refuses
// cross-origin requests for its own dev resources, which would leave the page
// server-rendered but never hydrated.
const baseURL = process.env.E2E_BASE_URL ?? `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "./tests/e2e",
  globalSetup: "./tests/e2e/global-setup.ts",
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : [["list"]],
  timeout: 30_000,
  expect: { timeout: 10_000 },

  use: {
    baseURL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    locale: "es-CL",
  },

  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],

  // Reuse whatever is already on the port locally; start one in CI.
  webServer:
    process.env.E2E_BASE_URL || !configured
      ? undefined
      : {
          command: `npx next dev --port ${PORT}`,
          url: baseURL,
          reuseExistingServer: !process.env.CI,
          timeout: 120_000,
          stdout: "pipe",
          stderr: "pipe",
        },
});
