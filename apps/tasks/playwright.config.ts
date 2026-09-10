import { defineConfig, devices } from "@playwright/test";

const port = Number(process.env.PLAYWRIGHT_PORT ?? 3100);
const origin = `http://127.0.0.1:${port}`;
const supabasePort = Number(process.env.PLAYWRIGHT_SUPABASE_PORT ?? 54329);
const supabaseOrigin = `http://127.0.0.1:${supabasePort}`;

/**
 * Task keys carry a build-time prefix, and a working tree gets it from
 * `.env.local` — which is untracked, so CI builds with the compiled default
 * instead. `/task/RMT-5` then 404s there and only there. Pinning the prefix on
 * `process.env` fixes both halves at once: the build inherits it through
 * `webServer.env` below, and the spec workers read the same value back, so a
 * suite pointed at an outside server by `PLAYWRIGHT_TEST_BASE_URL` still asks
 * for the keys that server actually mints.
 */
process.env.NEXT_PUBLIC_TASK_KEY_PREFIX ??= "RMT";

/**
 * The suite runs against a production server rather than `next dev`.
 *
 * Next allows only one dev server per project directory, so a `npm run dev`
 * open in another terminal used to make the whole suite unrunnable — the
 * webserver exited with "Another next dev server is already running" and every
 * spec failed before it started. `next start` has no such restriction, and it
 * exercises the build that actually ships.
 *
 * The cost is a build on each cold run. `reuseExistingServer` keeps that to
 * once per session locally, and `PLAYWRIGHT_TEST_BASE_URL` with
 * `PLAYWRIGHT_SKIP_WEBSERVER=1` points the suite at a server you already have.
 */
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: process.env.PLAYWRIGHT_TEST_BASE_URL ?? origin,
    trace: "on-first-retry",
  },
  webServer: process.env.PLAYWRIGHT_SKIP_WEBSERVER
    ? undefined
    : [
        {
          command: "node tests/e2e/mock-supabase.mjs",
          url: `${supabaseOrigin}/health`,
          reuseExistingServer: !process.env.CI,
          timeout: 30_000,
          env: {
            ...process.env,
            PLAYWRIGHT_SUPABASE_PORT: String(supabasePort),
          },
        },
        {
          command: `npm run build && npm run start -- --hostname 127.0.0.1 --port ${port}`,
          url: `${origin}/login`,
          reuseExistingServer: !process.env.CI,
          // A cold run builds first, which does not fit the 60s default.
          timeout: 300_000,
          env: {
            ...process.env,
            SKIP_DATABASE_CONTRACT_CHECK: "1",
            // These are inlined at build time, so they must be set for the build
            // step above, not just for the server it starts.
            NEXT_PUBLIC_SUPABASE_URL: supabaseOrigin,
            NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test",
            // The double serves no statuses, so the first signed-in request
            // reaches the bootstrap that seeds them, and that one needs the
            // admin key. A working tree has it from `.env.local`; CI has no
            // such file, so sign-in failed there and only there.
            SUPABASE_SECRET_KEY: "sb_secret_test",
          },
        },
      ],
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
