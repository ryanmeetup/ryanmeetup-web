/**
 * Local preview of /reviews/mine with sample data, for clicking through every
 * view by hand. Run `npm run preview:my-reviews` from apps/store.
 *
 * It starts the synthetic Supabase/Shopify fixture the browser suite uses, a
 * dev server pointed only at it, and a Chromium window already signed in as a
 * synthetic buyer. A scenario page switches between views. Nothing here talks
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
import { demoProductId, demoProducts } from "../lib/demo-data";
import { customerAccountConfig, customerAccountEnvironment } from "../tests/fixtures/customer-account";
import { fakeSupabaseKey } from "../tests/fixtures/customer-auth-backend";
import { customerPurchasePage } from "../tests/fixtures/customer-purchase";

const root = path.resolve(__dirname, "..");
const storePort = Number(process.env.PREVIEW_PORT ?? 3133);
const fixturePort = Number(process.env.PREVIEW_FIXTURE_PORT ?? 54360);
const controlPort = Number(process.env.PREVIEW_CONTROL_PORT ?? 3134);
const store = `http://localhost:${storePort}`;
const fixture = `http://127.0.0.1:${fixturePort}`;
const control = `http://localhost:${controlPort}`;
// The fixture's default rows (the 125-review scenario) belong to this subject.
const subject = "buyer-a";

// ---------------------------------------------------------------------------
// Sample data
// ---------------------------------------------------------------------------

const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
/** Database versions carry microseconds; the store rejects anything else. */
const version = (daysAgo: number) => new Date(Date.UTC(2026, 10, 20, 15) - daysAgo * 86400000).toISOString().replace(/Z$/, "123Z");
const published = (daysAgo: number) => new Date(Date.UTC(2026, 10, 20, 15) - daysAgo * 86400000).toISOString();
const numeric = (gid: string) => gid.split("/").pop()!;
const product = (handle: string) => {
  const found = demoProducts.find((item) => item.handle === handle);
  if (!found) throw new Error(`No demo product ${handle}`);
  return found;
};

type Status = "pending" | "published" | "rejected" | "hidden" | "withdrawn";
type Content = { rating: number; title: string; body: string; nameStyle: "full" | "first-initial" | "anonymous"; displayName: string };
type SampleReview = { n: number; status: Status; daysAgo: number; content: Content; verified?: boolean; pendingEdit?: boolean }
  & ({ handle: string; variant?: string | null } | { offStorefront: { title: string; variant: string | null } });

const names = { full: "Ryan Fixture", "first-initial": "Ryan F.", anonymous: "Anonymous" } as const;
const content = (rating: number, title: string, body: string, nameStyle: Content["nameStyle"] = "first-initial"): Content =>
  ({ rating, title, body, nameStyle, displayName: names[nameStyle] });

function record(review: SampleReview) {
  const item = "handle" in review
    ? { productId: numeric(demoProductId(review.handle)), productTitle: product(review.handle).title, variantTitle: review.variant ?? null }
    : { productId: String(8000000000 + review.n), productTitle: review.offStorefront.title, variantTitle: review.offStorefront.variant };
  const live = review.status === "published" || review.status === "hidden";
  return {
    subject,
    published: live ? (review.pendingEdit ? { ...review.content, body: "The version that's live right now." } : review.content) : null,
    value: {
      id: uuid(review.n), lineId: review.verified === false ? null : String(9000 + review.n), item, status: review.status,
      hasPendingEdit: review.status === "published" && Boolean(review.pendingEdit),
      publishedAt: review.status === "published" ? published(review.daysAgo - 1) : null,
      createdAt: version(review.daysAgo), updatedAt: version(review.daysAgo), current: review.content,
    },
  };
}

const everyStatus: SampleReview[] = [
  { n: 1, status: "pending", daysAgo: 1, handle: "ryan-meetup-tee", variant: "M / Black",
    content: content(5, "Wore it to three Ryan meetups", "Soft, fits true to size, and strangers named Ryan keep nodding at me.", "anonymous") },
  { n: 2, status: "published", daysAgo: 6, handle: "hello-my-name-is-ryan-sweatshirt", variant: "L / Cream",
    content: content(5, "Warmest name tag I own", "Thick, cozy, and saves me introducing myself.", "full") },
  { n: 3, status: "published", daysAgo: 12, pendingEdit: true, handle: "ryan-name-tag-shirt", variant: "S / White",
    content: content(4, "Still great after a dozen washes", "Updated: the print hasn't faded at all. Knocked one star off because I wanted it in more colours.") },
  { n: 4, status: "rejected", daysAgo: 15, verified: false, handle: "ryans-dad-name-tag-shirt", variant: null,
    content: content(1, "Not my dad", "Bought it for my dad. His name is Steve.") },
  { n: 5, status: "hidden", daysAgo: 21, handle: "certified-ryan-tote", variant: "One size / Natural",
    content: content(3, "Holds a lot of Ryans", "Roomy tote, a little thin.") },
  { n: 6, status: "withdrawn", daysAgo: 40, offStorefront: { title: "RyanCon 2025 Lanyard", variant: null },
    content: content(4, "Classic lanyard", "No longer in the shop, so this one shows the fallback thumbnail.") },
];

const longText: SampleReview[] = [
  { n: 20, status: "pending", daysAgo: 2, offStorefront: { title: "The Extremely Limited Commemorative RyanCon Founders' Edition Heavyweight Garment-Dyed Crewneck Sweatshirt", variant: "2XL / Washed Charcoal With Contrast Stitching" },
    content: content(5, "A title long enough to check that review titles wrap politely instead of overflowing on phones", Array.from({ length: 5 }, (_, i) => `Paragraph ${i + 1}. This review keeps going so the body wraps across several lines at every width, including phones.`).join("\n\n")) },
  ...everyStatus.slice(1, 3),
];

let orderNumber = 1000;
/** One shipped order with a single line, in the Customer API's shape. */
function order(handle: string, variant: string, { quantity = 1, shippedDaysAgo = 4 } = {}) {
  const n = ++orderNumber;
  const page = customerPurchasePage();
  page.order.id = `gid://shopify/Order/${n}`;
  page.order.name = `#${n}`;
  page.order.customer.id = "gid://shopify/Customer/123";
  page.order.updatedAt = published(shippedDaysAgo);
  const line = page.order.lineItems.nodes[0];
  Object.assign(line, { id: `gid://shopify/LineItem/${n}1`, productId: demoProductId(handle), variantId: `gid://shopify/ProductVariant/${n}2`,
    name: product(handle).title, variantTitle: variant, quantity, refundableQuantity: quantity });
  const fulfillment = page.order.fulfillments.nodes[0];
  fulfillment.id = `gid://shopify/Fulfillment/${n}3`;
  fulfillment.createdAt = published(shippedDaysAgo);
  Object.assign(fulfillment.fulfillmentLineItems.nodes[0], { id: `gid://shopify/FulfillmentLineItem/${n}4`, quantity, lineItem: { id: line.id } });
  return page;
}
const purchases = () => {
  orderNumber = 1000;
  return [order("ryan-society-cap", "One size / Navy", { shippedDaysAgo: 2 }), order("ryans-dad-name-tag-shirt", "L / Natural", { quantity: 2 }),
    order("ryan-meetup-tee", "XL / Black", { shippedDaysAgo: 9 })];
};

type Scenario = { label: string; description: string; reset?: Record<string, unknown>; signedOut?: true };
const scenarios: Record<string, Scenario> = {
  everything: { label: "Everything", description: "Three purchases to review, plus one review in every status: pending, published, published with an edit waiting, not approved (unverified), hidden, and withdrawn (off the storefront).",
    reset: { records: everyStatus.map(record), purchases: purchases() } },
  "reviews-only": { label: "Reviews only", description: "Every status, nothing left to review.", reset: { records: everyStatus.map(record) } },
  "to-review-only": { label: "To review only", description: "Purchases to review, no reviews written yet.", reset: { records: [], purchases: purchases() } },
  "single": { label: "One of each", description: "One purchase and one pending review, like the original screenshot.",
    reset: { records: [record(everyStatus[0])], purchases: purchases().slice(0, 1) } },
  "long-text": { label: "Long text", description: "Very long product names, variants, titles and bodies.", reset: { records: longText.map(record) } },
  many: { label: "125 reviews", description: "Paging with the Load more button.", reset: { many: true, records: undefined } },
  empty: { label: "Empty", description: "No reviews and nothing to review.", reset: { records: [] } },
  "load-error": { label: "Load error", description: "The review list fails to load.", reset: { records: everyStatus.map(record), failRead: true } },
  "signed-out": { label: "Signed out", description: "The sign-in prompt.", signedOut: true },
};

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
    SHOPIFY_STOREFRONT_API_TOKEN: "", SHOPIFY_PRIVATE_ACCESS_TOKEN: "", SHOPIFY_ADMIN_CLIENT_ID: "", SHOPIFY_ADMIN_CLIENT_SECRET: "", STORE_REVIEW_PHOTOS_ENABLED: "",
    NODE_OPTIONS: `--import=${path.join(root, "tests/fixtures/my-reviews-preload.mjs")}`,
  }, "store");
  await waitFor(store);

  const shotsDir = process.env.PREVIEW_SCREENSHOTS ? path.resolve(process.env.PREVIEW_SCREENSHOTS) : null;
  const browser = await chromium.launch({ headless: Boolean(shotsDir) });
  const context = await browser.newContext({ viewport: null });
  let current = "everything";
  let signedIn = false;
  async function load(key: string) {
    const scenario = scenarios[key];
    if (scenario.signedOut) { await post("/__revoke"); await context.clearCookies({ name: "__Host-store-customer-session" }); signedIn = false; }
    else {
      await post("/__reset", { ...scenario.reset, keepSessions: true });
      if (!signedIn) { await signIn(context); signedIn = true; }
    }
    current = key;
  }

  createServer(async (req, res) => {
    const match = /^\/scenario\/([a-z-]+)$/.exec(req.url ?? "");
    if (match && scenarios[match[1]]) {
      try { await load(match[1]); } catch (error) { res.writeHead(500); res.end(String(error)); return; }
      res.writeHead(302, { location: `${store}/reviews/mine` }); res.end(); return;
    }
    res.writeHead(200, { "content-type": "text/html; charset=utf-8" }); res.end(controlPage(current));
  }).listen(controlPort, "localhost");

  // PREVIEW_SCREENSHOTS=<dir> captures every scenario headlessly and exits, to check the data still renders.
  if (shotsDir) {
    const page = await context.newPage();
    await page.setViewportSize({ width: 1280, height: 900 });
    for (const key of Object.keys(scenarios)) {
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
