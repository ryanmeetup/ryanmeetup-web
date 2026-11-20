import { defineConfig, devices } from "@playwright/test";
import path from "node:path";
import { customerAccountEnvironment } from "./tests/fixtures/customer-account";

const port=Number(process.env.MY_REVIEWS_PORT??3132);
const fixturePort=Number(process.env.MY_REVIEWS_FIXTURE_PORT??54359);
export default defineConfig({
  testDir:"./tests",testMatch:["my-reviews-browser.spec.ts","review-composer-browser.spec.ts"],workers:1,fullyParallel:false,
  use:{baseURL:`http://localhost:${port}`,trace:"retain-on-failure"},
  webServer:[
    {command:"node tests/fixtures/fake-supabase-server.mjs",url:`http://127.0.0.1:${fixturePort}/health`,reuseExistingServer:false,env:{FAKE_SUPABASE_PORT:String(fixturePort)}},
    {command:`npm run dev -- --port ${port}`,url:`http://localhost:${port}`,timeout:120000,reuseExistingServer:false,
      env:{...process.env,...customerAccountEnvironment,SUPABASE_URL:`http://127.0.0.1:${fixturePort}`,MY_REVIEWS_FIXTURE:"1",NEXT_DIST_DIR:".next-preview",
        SHOPIFY_STOREFRONT_API_TOKEN:"",STORE_REVIEW_PHOTOS_ENABLED:"false",
        NODE_OPTIONS:`--import=${path.resolve(__dirname,"tests/fixtures/my-reviews-preload.mjs")}`}},
  ],
  projects:[{name:"chromium",use:{...devices["Desktop Chrome"]}}],
});
