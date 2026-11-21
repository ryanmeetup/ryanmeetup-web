import { expect, test } from "@playwright/test";
import type { APIRequestContext, Page } from "@playwright/test";
import { summarizeReviewRatings } from "@ryanmeetup/reviews";
import { tee, dad } from "./fixtures/products";

const fixture = `http://127.0.0.1:${process.env.PRODUCT_REVIEW_FIXTURE_PORT ?? 54369}`;
const numeric = (id: string) => id.split("/").at(-1)!;
const cards = (page: Page) => page.locator('#review-feed > li');

async function configure(request: APIRequestContext, count = 46) {
  const reviews = Array.from({ length: count }, (_, i) => {
    const n = count - i;
    const product = n % 2 ? tee : dad;
    return {
      id: `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`, rating: i < 20 ? 5 as const : 1 as const,
      title: `Shop review ${n}`, body: `Published feedback ${n}.`, displayName: `Ryan ${n}`,
      publishedAt: new Date(Date.UTC(2026, 10, 20, 12, 0, n)).toISOString(), editedAt: null,
      item: { productId: numeric(product.id), productTitle: product.title, variantTitle: null },
      verifiedPurchase: n % 2 === 0, photos: [],
      reply: n === 1 ? { body: "A reply on an older review.", publishedAt: "2026-11-20T13:00:00.000Z" } : null,
    };
  });
  const products = Object.fromEntries([tee, dad].map((product) => {
    const rows = reviews.filter((review) => review.item.productId === numeric(product.id));
    return [numeric(product.id), { summary: summarizeReviewRatings(rows.map((review) => review.rating)), reviews: rows }];
  }));
  expect((await request.post(`${fixture}/__configure`, { data: products })).ok()).toBe(true);
}

async function choose(page: Page, label: "Rating" | "Sort", value: string) {
  await page.getByRole("group", { name: "Filter and sort reviews" }).getByRole("button", { name: new RegExp(`^${label}`) }).click();
  await page.getByRole("option", { name: value, exact: true }).click();
}

test.beforeEach(async ({ request }) => configure(request));

test("the default shop feed retains bounded paging and links across products", async ({ page, request }) => {
  await page.goto("/reviews");
  await expect(cards(page)).toHaveCount(20);
  await expect(cards(page).first()).toContainText("Shop review 46");
  await expect(page.getByRole("status").filter({ hasText: "Showing 20 reviews" })).toBeVisible();
  await page.getByRole("button", { name: "Load more reviews", exact: true }).click();
  await expect(cards(page)).toHaveCount(40);
  await page.getByRole("button", { name: "Load more reviews", exact: true }).click();
  await expect(cards(page)).toHaveCount(46);
  await expect(page.getByRole("button", { name: "Load more reviews", exact: true })).toHaveCount(0);
  expect(await cards(page).evaluateAll((rows) => new Set(rows.map((row) => row.querySelector("article")?.id)).size)).toBe(46);
  for (const product of [tee, dad]) await expect(page.getByRole("link", { name: `Review of ${product.title}`, exact: true }).first()).toHaveAttribute("href", /^\/products\/[^#]+$/);
  expect(await (await request.get(`${fixture}/__state`)).json()).toEqual({ privateOperationAttempts: 0 });
});

test("ratings and every sort include older pages, preserve product details and reset from the cache", async ({ page }) => {
  let reads = 0;
  page.on("request", (request) => { if (request.url().includes("/api/reviews/feed?")) reads += 1; });
  await page.goto("/reviews");
  await choose(page, "Rating", "1 star");
  await expect(cards(page)).toHaveCount(26);
  await expect(cards(page).first()).toContainText("Shop review 26");
  await expect(page.getByRole("status").filter({ hasText: "Showing 26 of 46 reviews" })).toBeVisible();
  await choose(page, "Sort", "Oldest first");
  await expect(cards(page).first()).toContainText("Shop review 1");
  await expect(cards(page).first().getByRole("link", { name: `Review of ${tee.title}`, exact: true })).toHaveAttribute("href", `/products/${tee.handle}`);
  await choose(page, "Rating", "3 stars");
  await expect(cards(page)).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "No reviews match this rating" })).toBeVisible();
  await page.getByRole("button", { name: "Reset filters", exact: true }).click();
  await expect(cards(page)).toHaveCount(46);
  await expect(cards(page).first()).toContainText("Shop review 46");
  await expect(page.getByRole("button", { name: "Reset filters", exact: true })).toHaveCount(0);
  await choose(page, "Sort", "Lowest rated");
  await expect(cards(page).first()).toContainText("Shop review 26");
  await choose(page, "Sort", "Highest rated");
  await expect(cards(page).first()).toContainText("Shop review 46");
  await choose(page, "Sort", "Newest first");
  await expect(cards(page).first()).toContainText("Shop review 46");
  expect(reads).toBe(2);
});

test("a pending refinement hides partial matches, shares one request and retries from the failed page", async ({ page }) => {
  let release!: () => void;
  const held = new Promise<void>((resolve) => { release = resolve; });
  const cursors: string[] = [];
  await page.route("**/api/reviews/feed?**", async (route) => {
    cursors.push(new URL(route.request().url()).searchParams.get("cursor")!);
    if (cursors.length === 1) await held;
    if (cursors.length === 2) await route.fulfill({ status: 503, json: { error: "Synthetic outage" } });
    else await route.continue();
  });
  try {
    await page.goto("/reviews");
    await choose(page, "Rating", "1 star");
    await expect(page.getByRole("region", { name: "Review results", exact: true })).toHaveAttribute("aria-busy", "true");
    await expect(page.getByRole("heading", { name: "Finding matching reviews" })).toBeVisible();
    await expect(cards(page)).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Loading reviews…", exact: true })).toBeDisabled();
    await choose(page, "Sort", "Oldest first");
    expect(cursors).toHaveLength(1);
    release();
    await expect(page.locator("main").getByRole("alert")).toContainText("More reviews couldn't load.");
    await expect(cards(page)).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "No reviews match this rating" })).toHaveCount(0);
    await page.getByRole("button", { name: "Retry loading reviews", exact: true }).click();
    await expect(cards(page)).toHaveCount(26);
    await expect(cards(page).first()).toContainText("Shop review 1");
    expect(cursors).toHaveLength(3);
    expect(cursors[1]).toBe(cursors[2]);
  } finally { release(); }
});

test("changing filters during a normal continuation upgrades that read to the complete feed", async ({ page }) => {
  let release!: () => void;
  const held = new Promise<void>((resolve) => { release = resolve; });
  let reads = 0;
  await page.route("**/api/reviews/feed?**", async (route) => {
    reads += 1;
    if (reads === 1) await held;
    await route.continue();
  });
  try {
    await page.goto("/reviews");
    await page.getByRole("button", { name: "Load more reviews", exact: true }).click();
    await choose(page, "Sort", "Oldest first");
    release();
    await expect(cards(page)).toHaveCount(46);
    await expect(cards(page).first()).toContainText("Shop review 1");
    expect(reads).toBe(2);
  } finally { release(); }
});

test("shop review controls fit both themes at mobile and desktop boundaries", async ({ page, request }, testInfo) => {
  await configure(request, 2);
  await page.goto("/reviews");
  await choose(page, "Sort", "Highest rated");
  const controls = page.getByRole("group", { name: "Filter and sort reviews" });
  for (const theme of ["light", "dark"]) {
    await page.evaluate((value) => { document.documentElement.classList.remove("light", "dark"); document.documentElement.classList.add(value); }, theme);
    for (const width of [390, 1024, 1280, 1536]) {
      await page.setViewportSize({ width, height: 1000 });
      await controls.scrollIntoViewIfNeeded();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      if (width === 390) {
        for (const name of [/^Rating/, /^Sort/, /^Reset filters$/]) {
          const bounds = await controls.getByRole("button", { name }).boundingBox();
          expect(bounds!.width).toBeGreaterThan(300);
        }
      }
      await page.locator("main").screenshot({ path: testInfo.outputPath(`shop-review-controls-${theme}-${width}.png`) });
    }
  }
});
