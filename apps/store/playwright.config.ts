import { defineConfig } from "@playwright/test";

// The e2e server runs on its own port, with its own build directory, so a run
// never competes with the dev server on 3002. Next keeps its dev lock inside
// the build directory, which is what lets the two coexist.
const port = Number(process.env.PLAYWRIGHT_PORT ?? 3102);
// Next's dev server answers /_next/static with a 403 for requests that arrive
// on 127.0.0.1, so pages would never hydrate; the e2e origin has to be localhost.
const origin = `http://localhost:${port}`;
// STORE_BASE_URL points the suite at a server you started yourself, such as a
// production build or a custom-reviews preview, instead of starting one.
const baseURL = process.env.STORE_BASE_URL || origin;
// Review storage goes to a synthetic Supabase, never the RMT project in .env.local.
const fakeSupabasePort = Number(process.env.FAKE_SUPABASE_PORT ?? 54360);

export default defineConfig({
  testDir: "./tests",
  testIgnore: ["my-reviews-browser.spec.ts", "review-composer-browser.spec.ts"],
  fullyParallel: false,
  retries: 0,
  reporter: "line",
  use: {
    baseURL,
    trace: "retain-on-failure",
  },
  webServer: process.env.STORE_BASE_URL ? undefined : [{
    command: "node tests/fixtures/fake-supabase-server.mjs",
    url: `http://127.0.0.1:${fakeSupabasePort}/health`,
    reuseExistingServer: false,
    env: { FAKE_SUPABASE_PORT: String(fakeSupabasePort) },
  }, {
    command: `npm run dev -- --port ${port}`,
    url: origin,
    reuseExistingServer: !process.env.CI,
    env: {
      ...process.env,
      NEXT_DIST_DIR: ".next-e2e",
      // The suite runs against the demo catalog, never the live Shopify store
      // in .env.local. Empty values win over .env files.
      SHOPIFY_STORE_DOMAIN: "",
      SHOPIFY_STOREFRONT_API_TOKEN: "",
      JUDGEME_SHOP_DOMAIN: "",
      JUDGEME_PUBLIC_TOKEN: "",
      JUDGEME_PRIVATE_API_TOKEN: "",
      SUPABASE_URL: `http://127.0.0.1:${fakeSupabasePort}`,
      SUPABASE_SECRET_KEY: "synthetic-supabase-secret",
      SHOPIFY_CUSTOMER_ACCOUNT_SHOP_ID: "123456",
    },
  }],
});
