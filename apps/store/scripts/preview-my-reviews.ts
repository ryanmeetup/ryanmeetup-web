/**
 * Local preview of /reviews/mine with sample data, for clicking through every
 * view by hand. Run `npm run preview:my-reviews` from apps/store.
 *
 * It starts the synthetic Supabase/Shopify fixture the browser suite uses, a
 * dev server pointed only at it, and a Chromium window already signed in as a
 * synthetic buyer. A scenario page switches between views. Unlike the
 * dev-only mock that /reviews/mine shows a signed-out visitor on localhost,
 * this runs the real API routes and session checks. Nothing here talks
 * to live Shopify or Supabase: the dev server's preload refuses to start with
 * anything but the synthetic credentials.
 */
import { spawn, type ChildProcess } from "node:child_process";
import { createServer } from "node:http";
import path from "node:path";
import { chromium, type BrowserContext } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { createCustomerAuthBackend } from "../lib/customer-account/backend";
import { customerAccountIssuer } from "../lib/customer-account/config";
import { createCustomerAccountStorage } from "../lib/customer-account/storage";
import type { BuyerReview } from "@ryanmeetup/reviews";
import { demoProductId, demoProducts } from "../lib/demo-data";
import { SAMPLE_SCENARIOS, isSampleScenario, sampleScenario, type SampleScenario, type SamplePurchase } from "../lib/my-reviews-samples";
import { customerAccountConfig, customerAccountEnvironment } from "../tests/fixtures/customer-account";
import { fakeSupabaseKey } from "../tests/fixtures/customer-auth-backend";
import { customerPurchasePage } from "../tests/fixtures/customer-purchase";

const root = path.resolve(__dirname, "..");
const storePort = Number(process.env.PREVIEW_PORT ?? 3133);
const fixturePort = Number(process.env.PREVIEW_FIXTURE_PORT ?? 54361);
const controlPort = Number(process.env.PREVIEW_CONTROL_PORT ?? 3134);
const store = `http://localhost:${storePort}`;
const fixture = `http://127.0.0.1:${fixturePort}`;
const control = `http://localhost:${controlPort}`;
const subject = "preview-buyer";

// ---------------------------------------------------------------------------
// Sample data: the same scenarios as the dev-only mock on /reviews/mine
// ---------------------------------------------------------------------------

/** A sample review as a fixture row; live statuses carry their published text. */
const record = (review: BuyerReview) => ({ subject, published: ["published", "hidden"].includes(review.status) ? review.current : null, value: review });

/** One shipped order with a single line, in the Customer API's shape. */
function order(purchase: SamplePurchase) {
  const n = purchase.orderNumber;
  const shipped = new Date(Date.now() - purchase.shippedDaysAgo * 86400000).toISOString();
  const page = customerPurchasePage();
  Object.assign(page.order, { id: `gid://shopify/Order/${n}`, name: `#${n}`, updatedAt: shipped });
  page.order.customer.id = "gid://shopify/Customer/123";
  const line = page.order.lineItems.nodes[0];
  Object.assign(line, { id: `gid://shopify/LineItem/${n}1`, productId: demoProductId(purchase.handle), variantId: `gid://shopify/ProductVariant/${n}2`,
    name: demoProducts.find((product) => product.handle === purchase.handle)!.title, variantTitle: purchase.variant,
    quantity: purchase.quantity, refundableQuantity: purchase.quantity });
  const fulfillment = page.order.fulfillments.nodes[0];
  Object.assign(fulfillment, { id: `gid://shopify/Fulfillment/${n}3`, createdAt: shipped });
  Object.assign(fulfillment.fulfillmentLineItems.nodes[0], { id: `gid://shopify/FulfillmentLineItem/${n}4`, quantity: purchase.quantity, lineItem: { id: line.id } });
  return page;
}

function fixtureReset(key: SampleScenario) {
  const { reviews, purchases } = sampleScenario(key);
  return { records: reviews.map(record), purchases: purchases.map(order), ...(key === "load-error" ? { failRead: true } : {}) };
}
const scenarios = SAMPLE_SCENARIOS;

// ---------------------------------------------------------------------------
// Processes
// ---------------------------------------------------------------------------

const children: ChildProcess[] = [];
function start(command: string, args: string[], env: NodeJS.ProcessEnv, label: string) {
  const child = spawn(command, args, { cwd: root, env, stdio: ["ignore", "pipe", "pipe"] });
  const prefix = (chunk: Buffer) => chunk.toString().split("\n").filter(Boolean).map((line) => `[${label}] ${line}`).join("\n");
  child.stdout?.on("data", (chunk: Buffer) => console.log(prefix(chunk)));
  child.stderr?.on("data", (chunk: Buffer) => console.error(prefix(chunk)));
  children.push(child);
  return child;
}
async function waitFor(url: string, timeoutMs = 180000) {
  const until = Date.now() + timeoutMs;
  while (Date.now() < until) {
    if (await fetch(url).then((response) => response.status < 500, () => false)) return;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`Timed out waiting for ${url}`);
}
function stop(code = 0) {
  for (const child of children) child.kill("SIGTERM");
  process.exit(code);
}
process.on("SIGINT", () => stop());
process.on("SIGTERM", () => stop());

async function post(pathname: string, data: unknown = {}) {
  const response = await fetch(`${fixture}${pathname}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(data) });
  if (!response.ok) throw new Error(`Fixture ${pathname} failed: ${response.status}`);
}

/** A synthetic encrypted session minted through the store's real storage contract, as the browser suite does. */
async function signIn(context: BrowserContext) {
  const scope = { shopId: customerAccountConfig.shopId, clientId: customerAccountConfig.clientId, issuer: customerAccountIssuer(customerAccountConfig.shopId), redirectUri: customerAccountConfig.redirectUri };
  const backend = createCustomerAuthBackend({ database: createClient(fixture, fakeSupabaseKey, { auth: { persistSession: false } }), scope });
  const storage = createCustomerAccountStorage({ config: customerAccountConfig, keyring: { activeKeyId: "test", keys: new Map([["test", Buffer.alloc(32, 7)]]) }, backend });
  const created = await storage.createSession({ subject, tokens: { accessToken: "synthetic-access", refreshToken: "synthetic-refresh", idToken: "synthetic-id" },
    accessExpiresAt: Date.now() + 3600000, expiresAt: Date.now() + 86400000 });
  await context.clearCookies({ name: "__Host-store-customer-session" });
  await context.addCookies([{ name: "__Host-store-customer-session", value: created.id, url: `https://localhost:${storePort}`, secure: true, httpOnly: true, sameSite: "Lax" }]);
}

const escape = (text: string) => text.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
function controlPage(current: string) {
  const items = Object.entries(scenarios).map(([key, scenario]) => `<li${key === current ? ' aria-current="true"' : ""}>
    <a href="/scenario/${key}" target="store">${escape(scenario.label)}</a><p>${escape(scenario.description)}</p></li>`).join("");
  return `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>My reviews preview</title>
<style>:root{color-scheme:light dark}body{font:15px/1.5 system-ui,sans-serif;max-width:40rem;margin:2rem auto;padding:0 1rem}
ul{list-style:none;padding:0;display:grid;gap:.75rem}li{border:1px solid color-mix(in srgb,currentColor 15%,transparent);border-radius:.75rem;padding:.75rem 1rem}
li[aria-current]{border-color:currentColor}a{font-weight:600}p{margin:.25rem 0 0;opacity:.75}</style>
<h1>My reviews preview</h1><p>Pick a view. It loads in the store tab. Edits, withdrawals and new reviews work and last until you switch view or stop the script.</p>
<ul>${items}</ul></html>`;
}

async function main() {
  const fixtureEnv = { ...process.env, FAKE_SUPABASE_PORT: String(fixturePort) };
  start(process.execPath, ["tests/fixtures/fake-supabase-server.mjs"], fixtureEnv, "fixture");
  await waitFor(`${fixture}/health`);

  console.log(`Starting the store preview on ${store} (first compile takes a minute)…`);
  start("npm", ["run", "dev", "--", "--port", String(storePort)], {
    ...process.env, ...customerAccountEnvironment, SUPABASE_URL: fixture, MY_REVIEWS_FIXTURE: "1", NEXT_DIST_DIR: ".next-preview",
    SHOPIFY_STOREFRONT_API_TOKEN: "", SHOPIFY_PRIVATE_ACCESS_TOKEN: "", SHOPIFY_ADMIN_CLIENT_ID: "", SHOPIFY_ADMIN_CLIENT_SECRET: "", STORE_REVIEW_PHOTOS_ENABLED: "false",
    NODE_OPTIONS: `--import=${path.join(root, "tests/fixtures/my-reviews-preload.mjs")}`,
  }, "store");
  await waitFor(store);

  const shotsDir = process.env.PREVIEW_SCREENSHOTS ? path.resolve(process.env.PREVIEW_SCREENSHOTS) : null;
  const browser = await chromium.launch({ headless: Boolean(shotsDir) });
  const context = await browser.newContext({ viewport: null });
  let current: SampleScenario = "everything";
  let signedIn = false;
  async function load(key: SampleScenario) {
    if (key === "signed-out") { await post("/__revoke"); await context.clearCookies({ name: "__Host-store-customer-session" }); signedIn = false; }
    else {
      await post("/__reset", { ...fixtureReset(key), keepSessions: true });
      if (!signedIn) { await signIn(context); signedIn = true; }
    }
    current = key;
  }

  createServer(async (req, res) => {
    const match = /^\/scenario\/([a-z-]+)$/.exec(req.url ?? "");
    if (match && isSampleScenario(match[1])) {
      try { await load(match[1]); } catch (error) { res.writeHead(500); res.end(String(error)); return; }
      res.writeHead(302, { location: `${store}/reviews/mine` }); res.end(); return;
    }
    res.writeHead(200, { "content-type": "text/html; charset=utf-8" }); res.end(controlPage(current));
  }).listen(controlPort, "localhost");

  // PREVIEW_SCREENSHOTS=<dir> captures every scenario headlessly and exits, to check the data still renders.
  if (shotsDir) {
    const page = await context.newPage();
    await page.setViewportSize({ width: 1280, height: 900 });
    for (const key of Object.keys(scenarios) as SampleScenario[]) {
      await load(key);
      await page.goto(`${store}/reviews/mine`);
      await page.waitForLoadState("networkidle");
      await page.screenshot({ path: path.join(shotsDir, `${key}.png`), fullPage: true });
      console.log(`Captured ${key}`);
    }
    stop();
    return;
  }

  await load(current);
  const switcher = await context.newPage();
  await switcher.goto(control);
  const page = await context.newPage();
  // Links on the scenario page open here.
  await page.evaluate(() => { window.name = "store"; });
  await page.goto(`${store}/reviews/mine`);
  console.log(`\nMy reviews preview is ready.\n  Store:     ${store}/reviews/mine\n  Scenarios: ${control}\nClose the browser or press Ctrl+C to stop.\n`);
  browser.on("disconnected", () => stop());
}

main().catch((error) => { console.error(error); stop(1); });
