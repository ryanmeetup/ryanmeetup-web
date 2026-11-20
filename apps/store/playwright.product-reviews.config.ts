import { defineConfig, devices } from "@playwright/test";
import { customerAccountEnvironment } from "./tests/fixtures/customer-account";

const port = Number(process.env.PRODUCT_REVIEW_PORT ?? 3142);
const fixturePort = Number(process.env.PRODUCT_REVIEW_FIXTURE_PORT ?? 54369);

export default defineConfig({
  testDir: "./tests",
  outputDir: "./test-results-public-reviews/browser",
  // Kept out of the ordinary suite, which uses an empty public-review fixture.
  testMatch: ["product-review-scope.browser.ts", "public-review-replies.browser.ts", "public-review-pagination.browser.ts", "private-review-photos.browser.ts"],
  workers: 1,
  use: { baseURL: `http://localhost:${port}`, trace: "retain-on-failure" },
  webServer: [
    { command: "node tests/fixtures/product-review-scope-server.mjs", url: `http://127.0.0.1:${fixturePort}/health`, reuseExistingServer: false, env: { PRODUCT_REVIEW_FIXTURE_PORT: String(fixturePort) } },
    {
      command: `npm run dev -- --port ${port}`, url: `http://localhost:${port}`, timeout: 120000, reuseExistingServer: false,
      env: {
        // Valid synthetic auth configuration makes the pause test exercise
        // the explicit off switch, rather than missing credentials.
        ...process.env, ...customerAccountEnvironment, NEXT_DIST_DIR: ".next-e2e/product-reviews",
        STORE_CUSTOMER_ACCOUNT_SIGN_IN_ENABLED: "", STORE_REVIEW_PHOTOS_ENABLED: "false",
        SHOPIFY_STOREFRONT_API_TOKEN: "", SHOPIFY_CUSTOMER_ACCOUNT_SHOP_ID: "123456",
        SUPABASE_URL: `http://127.0.0.1:${fixturePort}`, SUPABASE_SECRET_KEY: "synthetic-supabase-secret",
      },
    },
  ],
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
