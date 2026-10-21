import { defineConfig, devices } from "@playwright/test";
import path from "node:path";

const port = Number(process.env.PLAYWRIGHT_RYD_PORT ?? 3110);
const databasePort = Number(process.env.PLAYWRIGHT_RYD_SUPABASE_PORT ?? 54339);
const database = `http://127.0.0.1:${databasePort}`;
const origin = `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: "ryd-workflows.spec.ts",
  // The fixture owns one workspace. Other specs use the normal test server.
  workers: 1,
  fullyParallel: false,
  use: {
    baseURL: origin,
    trace: "retain-on-failure",
    extraHTTPHeaders: { Origin: origin },
  },
  webServer: [
    {
      command: "node tests/e2e/mock-supabase.mjs",
      url: `${database}/health`,
      reuseExistingServer: false,
      env: {
        PLAYWRIGHT_SUPABASE_PORT: String(databasePort),
        PLAYWRIGHT_RYD_FIXTURE: "1",
      },
    },
    {
      command: `npm run build && npm run start -- --hostname 127.0.0.1 --port ${port}`,
      url: `${origin}/login`,
      timeout: 300_000,
      reuseExistingServer: false,
      env: {
        ...process.env,
        TASKS_APP_URL: origin,
        TASKS_ALLOWED_ORIGINS: origin,
        NEXT_PUBLIC_TASKS_APP_URL: origin,
        RESEND_API_KEY: "",
        NEXT_PUBLIC_SUPABASE_URL: database,
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test",
        NEXT_PUBLIC_TASK_KEY_PREFIX: "RMT",
        SUPABASE_SECRET_KEY: "sb_secret_test",
        // The transport double has no Postgres catalogs; real schema checks
        // run separately and the production build must keep its preflight.
        SKIP_DATABASE_CONTRACT_CHECK: "1",
        PLAYWRIGHT_RYD_FIXTURE: "1",
        GOOGLE_CALENDAR_CLIENT_ID: "ryd-synthetic-client",
        GOOGLE_CALENDAR_CLIENT_SECRET: "ryd-synthetic-secret",
        GOOGLE_CALENDAR_TOKEN_KEY: Buffer.alloc(32, 8).toString("base64"),
        NODE_OPTIONS: `--import=${path.resolve(__dirname, "tests/e2e/ryd-google-preload.mjs")}`,
      },
    },
  ],
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"], colorScheme: "dark" },
    },
    {
      name: "chromium-mobile",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
        colorScheme: "light",
      },
    },
  ],
});
