import { expect, test } from "@playwright/test";
import type { APIRequestContext, Page } from "@playwright/test";
import { dad, ryan } from "./fixtures/products";
import type { Product } from "../lib/types";

const fixture = `http://127.0.0.1:${process.env.PRODUCT_REVIEW_FIXTURE_PORT ?? 54369}`;
const id = (product: Product) => product.id.split("/").at(-1)!;
function dataset(product: Product, count: number) {
  return {
    summary: { count, average: 4, distribution: { 1: 0, 2: 0, 3: 0, 4: count, 5: 0 } },
    reviews: Array.from({ length: count }, (_, i) => {
      const n = count - i;
      return {
        id: `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`, rating: 4, title: `Fixture review ${n}`, body: `Public feedback ${n}.`, displayName: `Ryan ${n}`,
        publishedAt: new Date(Date.UTC(2026, 10, 20, 12, 0, n)).toISOString(), editedAt: null,
        item: { productId: id(product), productTitle: product.title, variantTitle: null }, verifiedPurchase: true,
        photos: [], reply: n === 1 ? { body: "The oldest review has a public reply.", publishedAt: "2026-11-20T13:00:00.000Z" } : null,
      };
    }),
  };
}
async function configure(request: APIRequestContext) {
  expect((await request.post(`${fixture}/__configure`, { data: { [id(ryan)]: dataset(ryan, 45), [id(dad)]: dataset(dad, 1) } })).ok()).toBe(true);
}
const cards = (page: Page) => page.locator('#reviews ul[aria-label="Customer reviews"] > li');
const reviewAnchor = (n: number) => `#review-00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

async function choose(page: Page, label: "Rating" | "Sort", value: string) {
  await page.getByRole("group", { name: "Filter and sort reviews" }).getByRole("button", { name: new RegExp(`^${label}`) }).click();
  await page.getByRole("option", { name: value, exact: true }).click();
}

async function configureMixed(request: APIRequestContext, count = 45) {
  const product = dataset(ryan, count);
  // Every one-star match is beyond the initial twenty-row page.
  for (const [i, review] of product.reviews.entries()) review.rating = i < 20 ? 5 : 1;
  product.summary = { count, average: (20 * 5 + count - 20) / count, distribution: { 1: count - 20, 2: 0, 3: 0, 4: 0, 5: 20 } };
  expect((await request.post(`${fixture}/__configure`, { data: { [id(ryan)]: product, [id(dad)]: dataset(dad, 1) } })).ok()).toBe(true);
}

test.beforeEach(async ({ request }) => configure(request));

test("a direct review link loads older public pages and focuses the exact review", async ({ page }, testInfo) => {
  await page.goto(`/products/name-tag-shirt${reviewAnchor(1)}`);
  const target = page.locator(reviewAnchor(1));
  await expect(cards(page)).toHaveCount(45);
  await expect(target).toBeFocused();
  await expect(target).toBeInViewport();
  await expect(target).toContainText("The oldest review has a public reply.");
  for (const theme of ["light", "dark"]) {
    await page.evaluate((value) => { document.documentElement.classList.remove("light", "dark"); document.documentElement.classList.add(value); }, theme);
    for (const width of [390, 1280]) {
      await page.setViewportSize({ width, height: 900 });
      await target.scrollIntoViewIfNeeded();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await target.screenshot({ path: testInfo.outputPath(`review-link-${theme}-${width}.png`) });
    }
  }
});

test("a first-page review link preserves normal paging", async ({ page }) => {
  let requests = 0;
  page.on("request", (request) => { if (new URL(request.url()).pathname === "/api/reviews/page") requests += 1; });
  await page.goto(`/products/name-tag-shirt${reviewAnchor(45)}`);
  await expect(page.locator(reviewAnchor(45))).toBeFocused();
  await expect(cards(page)).toHaveCount(20);
  expect(requests).toBe(0);
});

test("a review link never exposes content missing from the public pages", async ({ page, request }) => {
  await page.goto(`/products/name-tag-shirt${reviewAnchor(999)}`);
  await expect(page.getByRole("status").filter({ hasText: "This review is no longer available on this product page." })).toBeVisible();
  await expect(cards(page)).toHaveCount(45);
  await expect(page.locator(reviewAnchor(999))).toHaveCount(0);
  expect(await (await request.get(`${fixture}/__state`)).json()).toEqual({ privateOperationAttempts: 0 });
});

test("a failed review link lookup waits for a deliberate retry", async ({ page }) => {
  let requests = 0;
  await page.route("**/api/reviews/page?**", async (route) => {
    requests += 1;
    if (requests === 1) await route.fulfill({ status: 503, json: { error: "Synthetic outage" } });
    else await route.continue();
  });
  await page.goto(`/products/name-tag-shirt${reviewAnchor(1)}`);
  await expect(page.locator("#reviews").getByRole("alert")).toContainText("More reviews couldn't load.");
  await expect(cards(page)).toHaveCount(20);
  expect(requests).toBe(1);
  await page.getByRole("button", { name: "Load more reviews", exact: true }).click();
  await expect(page.locator(reviewAnchor(1))).toBeFocused();
  await expect(cards(page)).toHaveCount(45);
  expect(requests).toBe(3);
});

test("all public pages are reachable while complete totals, JSON-LD and replies retain their scope", async ({ page }, testInfo) => {
  await page.addInitScript(() => localStorage.setItem("theme", "light"));
  await page.goto("/products/name-tag-shirt");
  await expect(cards(page)).toHaveCount(20);
  const action = page.getByRole("button", { name: "Load more reviews", exact: true });
  for (const theme of ["light", "dark"]) {
    if (theme === "dark") await page.getByRole("button", { name: "Change to dark mode", exact: true }).click();
    await expect(page.locator("html")).toHaveClass(theme);
    for (const width of [390, 1024, 1280, 1536]) {
      await page.setViewportSize({ width, height: 900 });
      await action.scrollIntoViewIfNeeded();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await action.locator("..").screenshot({ path: testInfo.outputPath(`pagination-${theme}-${width}.png`) });
    }
  }
  await page.getByRole("button", { name: "Load more reviews", exact: true }).click();
  await expect(cards(page)).toHaveCount(40);
  await page.getByRole("button", { name: "Load more reviews", exact: true }).click();
  await expect(cards(page)).toHaveCount(45);
  await expect(page.getByRole("button", { name: "Load more reviews", exact: true })).toHaveCount(0);
  await expect(page.locator("#reviews")).toContainText("Average rating from 45 reviews");
  expect(JSON.parse((await page.locator("#product-structured-data").textContent())!).aggregateRating.reviewCount).toBe(45);
  await expect(page.getByRole("article", { name: "Review by Ryan 1", exact: true })).toContainText("The oldest review has a public reply.");
  await expect(page.getByRole("article", { name: "Review by Ryan 1", exact: true }).getByText("Verified purchase", { exact: true })).toBeVisible();
  expect(await cards(page).evaluateAll((rows) => new Set(rows.map((row) => row.querySelector("h3")?.textContent)).size)).toBe(45);
});

test("a failed page keeps the list and cursor usable for a deliberate retry", async ({ page }) => {
  const cursors: string[] = [];
  await page.route("**/api/reviews/page?**", async (route) => {
    cursors.push(new URL(route.request().url()).searchParams.get("cursor")!);
    if (cursors.length === 1) await route.fulfill({ status: 503, json: { error: "Synthetic outage" } });
    else await route.continue();
  });
  await page.goto("/products/name-tag-shirt");
  await page.getByRole("button", { name: "Load more reviews", exact: true }).click();
  await expect(page.locator("#reviews").getByRole("alert")).toContainText("More reviews couldn't load.");
  await expect(cards(page)).toHaveCount(20);
  await page.getByRole("button", { name: "Load more reviews", exact: true }).click();
  await expect(cards(page)).toHaveCount(40);
  expect(cursors).toHaveLength(2);
  expect(cursors[0]).toBe(cursors[1]);
});

test("pending loads have one request, accessible progress and a disabled mobile action", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  let release!: () => void;
  const held = new Promise<void>((resolve) => { release = resolve; });
  let requests = 0;
  await page.route("**/api/reviews/page?**", async (route) => {
    requests += 1;
    await held;
    await route.continue();
  });
  try {
    await page.goto("/products/name-tag-shirt");
    await page.getByRole("button", { name: "Load more reviews", exact: true }).click();
    await expect(page.getByRole("button", { name: "Loading reviews…", exact: true })).toBeDisabled();
    await expect(page.locator('ul[aria-label="Customer reviews"]')).toHaveAttribute("aria-busy", "true");
    await expect(page.getByRole("status").filter({ hasText: "Loading more reviews…" })).toBeVisible();
    const button = await page.getByRole("button", { name: "Loading reviews…", exact: true }).boundingBox();
    expect(button!.width).toBeGreaterThan(300);
    await page.screenshot({ path: testInfo.outputPath("pagination-mobile-pending.png") });
    expect(requests).toBe(1);
    release();
    await expect(cards(page)).toHaveCount(40);
  } finally { release(); }
});

test("a product change discards a response from the previous review list", async ({ page }) => {
  let release!: () => void;
  const held = new Promise<void>((resolve) => { release = resolve; });
  await page.route("**/api/reviews/page?**", async (route) => {
    const response = await route.fetch();
    await held;
    await route.fulfill({ response }).catch(() => {});
  });
  try {
    await page.goto("/products/name-tag-shirt");
    await page.getByRole("button", { name: "Load more reviews", exact: true }).click();
    await expect(page.getByRole("button", { name: "Loading reviews…", exact: true })).toBeDisabled();
    await page.getByRole("button", { name: /^Style/ }).click();
    await page.getByRole("option", { name: "Ryan’s Dad", exact: true }).click();
    await expect(cards(page)).toHaveCount(1);
    release();
    await expect(page.getByRole("button", { name: "Load more reviews", exact: true })).toHaveCount(0);
    await expect(cards(page)).toHaveCount(1);
    await page.goBack();
    await expect(cards(page)).toHaveCount(20);
    await expect(page.getByRole("button", { name: "Load more reviews", exact: true })).toBeEnabled();
  } finally { release(); }
});

test("rating filters include older pages, combine with sorts, and reset without refetching", async ({ page, request }) => {
  await configureMixed(request);
  let reads = 0;
  page.on("request", (request) => { if (request.url().includes("/api/reviews/page?")) reads += 1; });
  await page.goto("/products/name-tag-shirt");
  await expect(cards(page)).toHaveCount(20);
  await choose(page, "Rating", "1 star");
  await expect(cards(page)).toHaveCount(25);
  await expect(cards(page).first()).toContainText("Fixture review 25");
  await expect(page.locator("#reviews")).toContainText("Showing 25 of 45 reviews");
  await expect(page.locator("#reviews")).toContainText("Average rating from 45 reviews");
  await choose(page, "Sort", "Oldest first");
  await expect(cards(page).first()).toContainText("Fixture review 1");
  await expect(cards(page).first()).toContainText("The oldest review has a public reply.");
  await choose(page, "Rating", "3 stars");
  await expect(cards(page)).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "No reviews match this rating" })).toBeVisible();
  await expect(page.locator("#reviews")).toContainText("Showing 0 of 45 reviews");
  await page.getByRole("button", { name: "Reset filters", exact: true }).click();
  await expect(cards(page)).toHaveCount(45);
  await expect(cards(page).first()).toContainText("Fixture review 45");
  await expect(page.getByRole("button", { name: "Reset filters", exact: true })).toHaveCount(0);
  await choose(page, "Sort", "Lowest rated");
  await expect(cards(page).first()).toContainText("Fixture review 25");
  await choose(page, "Sort", "Highest rated");
  await expect(cards(page).first()).toContainText("Fixture review 45");
  expect(reads).toBe(2);
});

test("filter loading never presents partial matches as final and resumes a failed continuation", async ({ page, request }) => {
  await configureMixed(request);
  let release!: () => void;
  const held = new Promise<void>((resolve) => { release = resolve; });
  const cursors: string[] = [];
  await page.route("**/api/reviews/page?**", async (route) => {
    cursors.push(new URL(route.request().url()).searchParams.get("cursor")!);
    if (cursors.length === 1) await held;
    if (cursors.length === 2) await route.fulfill({ status: 503, json: { error: "Synthetic outage" } });
    else await route.continue();
  });
  try {
    await page.goto("/products/name-tag-shirt");
    await choose(page, "Rating", "1 star");
    await expect(page.getByRole("heading", { name: "Finding matching reviews" })).toBeVisible();
    await expect(page.getByRole("region", { name: "Review results", exact: true })).toHaveAttribute("aria-busy", "true");
    await expect(cards(page)).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "No reviews match this rating" })).toHaveCount(0);
    await choose(page, "Sort", "Oldest first");
    expect(cursors).toHaveLength(1);
    release();
    await expect(page.locator("#reviews").getByRole("alert")).toContainText("More reviews couldn't load.");
    await expect(cards(page)).toHaveCount(0);
    await page.getByRole("button", { name: "Retry loading reviews", exact: true }).click();
    await expect(cards(page)).toHaveCount(25);
    await expect(cards(page).first()).toContainText("Fixture review 1");
    expect(cursors).toHaveLength(3);
    expect(cursors[1]).toBe(cursors[2]);
  } finally { release(); }
});

test("switching products clears filters and ignores a pending sort response", async ({ page, request }) => {
  await configureMixed(request);
  let release!: () => void;
  const held = new Promise<void>((resolve) => { release = resolve; });
  await page.route("**/api/reviews/page?**", async (route) => {
    const response = await route.fetch();
    await held;
    await route.fulfill({ response }).catch(() => {});
  });
  try {
    await page.goto("/products/name-tag-shirt");
    await choose(page, "Sort", "Oldest first");
    await expect(page.getByRole("heading", { name: "Finding matching reviews" })).toBeVisible();
    await page.getByRole("button", { name: /^Style/ }).click();
    await page.getByRole("option", { name: "Ryan’s Dad", exact: true }).click();
    await expect(cards(page)).toHaveCount(1);
    release();
    await expect(cards(page)).toHaveCount(1);
    await expect(page.getByRole("group", { name: "Filter and sort reviews" })).toContainText("Newest first");
    await expect(page.getByRole("button", { name: "Reset filters", exact: true })).toHaveCount(0);
  } finally { release(); }
});

test("review controls fit mobile and desktop boundaries in both themes", async ({ page, request }, testInfo) => {
  expect((await request.post(`${fixture}/__configure`, { data: { [id(ryan)]: dataset(ryan, 2) } })).ok()).toBe(true);
  await page.addInitScript(() => localStorage.setItem("theme", "light"));
  await page.goto("/products/name-tag-shirt");
  await choose(page, "Sort", "Highest rated");
  const controls = page.getByRole("group", { name: "Filter and sort reviews" });
  for (const theme of ["light", "dark"]) {
    if (theme === "dark") await page.getByRole("button", { name: "Change to dark mode", exact: true }).click();
    for (const width of [390, 1024, 1280, 1536]) {
      await page.setViewportSize({ width, height: 1000 });
      await controls.scrollIntoViewIfNeeded();
      await expect(controls.getByRole("button", { name: /^Sort/ })).toContainText("Highest rated");
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      if (width === 390) {
        const bounds = await controls.getByRole("button", { name: /^Sort/ }).boundingBox();
        expect(bounds!.width).toBeGreaterThan(300);
      }
      await page.locator("#reviews").screenshot({ path: testInfo.outputPath(`review-controls-${theme}-${width}.png`) });
    }
  }
});
