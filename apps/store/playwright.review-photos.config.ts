import { defineConfig, devices } from "@playwright/test";
import path from "node:path";
import { customerAccountEnvironment } from "./tests/fixtures/customer-account";

const port=Number(process.env.REVIEW_PHOTO_PORT??3152);
const fixturePort=Number(process.env.MY_REVIEWS_FIXTURE_PORT??54379);
process.env.MY_REVIEWS_FIXTURE_PORT=String(fixturePort);
export default defineConfig({
  testDir:"./tests",testMatch:"review-photos-browser.spec.ts",workers:1,fullyParallel:false,
  outputDir:"test-results-public-reviews/photo-browser",
  use:{baseURL:`http://localhost:${port}`,trace:"retain-on-failure"},
  webServer:[
    {command:"node tests/fixtures/fake-supabase-server.mjs",url:`http://127.0.0.1:${fixturePort}/health`,reuseExistingServer:false,env:{FAKE_SUPABASE_PORT:String(fixturePort)}},
    {command:`npm run dev -- --port ${port}`,url:`http://localhost:${port}`,timeout:120000,reuseExistingServer:false,
      env:{...process.env,...customerAccountEnvironment,SUPABASE_URL:`http://127.0.0.1:${fixturePort}`,MY_REVIEWS_FIXTURE:"1",NEXT_DIST_DIR:".next-e2e/review-photos",
        SHOPIFY_STOREFRONT_API_TOKEN:"",STORE_REVIEW_PHOTOS_ENABLED:"true",
        NODE_OPTIONS:`--import=${path.resolve(__dirname,"tests/fixtures/my-reviews-preload.mjs")}`}},
  ],
  projects:[{name:"chromium",use:{...devices["Desktop Chrome"]}}],
});
