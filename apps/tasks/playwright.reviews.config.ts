import { defineConfig, devices } from "@playwright/test";
import path from "node:path";

const port = Number(process.env.PLAYWRIGHT_REVIEWS_PORT ?? 3120);
const databasePort = Number(process.env.PLAYWRIGHT_REVIEWS_SUPABASE_PORT ?? 54349);
const origin = `http://127.0.0.1:${port}`;
const database = `http://127.0.0.1:${databasePort}`;
const project = "reviewstestprojectxx";

export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: "review-moderation.spec.ts",
  workers: 1,
  fullyParallel: false,
  use: { baseURL: origin, trace: "retain-on-failure", extraHTTPHeaders: { Origin: origin } },
  webServer: [
    { command: "node tests/e2e/mock-supabase.mjs", url: `${database}/health`, reuseExistingServer: false,
      env: { PLAYWRIGHT_SUPABASE_PORT: String(databasePort), PLAYWRIGHT_STORE_REVIEWS_FIXTURE: "1" } },
    { command: `npm run build && npm run start -- --hostname 127.0.0.1 --port ${port}`,
      url: `${origin}/login`, timeout: 300_000, reuseExistingServer: false,
      env: {
        ...process.env, TASKS_APP_URL: origin, TASKS_ALLOWED_ORIGINS: origin, NEXT_PUBLIC_TASKS_APP_URL: origin,
        NEXT_PUBLIC_SUPABASE_URL: `https://${project}.supabase.co`, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test",
        SUPABASE_SECRET_KEY: "sb_secret_test", SUPABASE_SERVICE_ROLE_KEY: "", RESEND_API_KEY: "",
        // This double has no Postgres catalogs; the ordinary production build
        // still runs its normal database contract check separately.
        SKIP_DATABASE_CONTRACT_CHECK: "1", PLAYWRIGHT_STORE_REVIEWS_FIXTURE: "1",
        PLAYWRIGHT_REVIEWS_SUPABASE_PORT: String(databasePort),
        STORE_REVIEWS_CUSTOMER_AUTH_ENABLED: "true", STORE_REVIEWS_SUPABASE_PROJECT_REF: project,
        STORE_REVIEWS_SERVICE_TOKEN_SHA256: "",
        STORE_REVIEWS_CUSTOMER_AUTH_SCOPE: JSON.stringify({ shopId: "123", clientId: "synthetic", issuer: "https://shopify.com/authentication/123", redirectUri: "https://store.test/api/reviews/auth/callback" }),
        NODE_OPTIONS: `--import=${path.resolve(__dirname, "tests/e2e/review-moderation-preload.mjs")}`,
      } },
  ],
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
