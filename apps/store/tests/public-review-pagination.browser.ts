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

async function choose(page: Page, label: "Rating" | "Sort" | "Source", value: string) {
  await page.getByRole("group", { name: "Filter and sort reviews" }).getByRole("button", { name: new RegExp(`^${label}`) }).click();
  await page.getByRole("option", { name: value, exact: true }).click();
}

const pager = (page: Page) => page.locator("#reviews").getByRole("navigation", { name: "reviews pagination" });
const reads = (page: Page) => {
  const urls: URL[] = [];
  page.on("request", (request) => { const url = new URL(request.url()); if (url.pathname === "/api/reviews/page") urls.push(url); });
  return urls;
};

async function configureMixed(request: APIRequestContext, count = 45) {
  const product = dataset(ryan, count);
  // The twenty newest are five stars; every one-star review sits below them.
  for (const [i, review] of product.reviews.entries()) review.rating = i < 20 ? 5 : 1;
  product.summary = { count, average: (20 * 5 + count - 20) / count, distribution: { 1: count - 20, 2: 0, 3: 0, 4: 0, 5: 20 } };
  expect((await request.post(`${fixture}/__configure`, { data: { [id(ryan)]: product, [id(dad)]: dataset(dad, 1) } })).ok()).toBe(true);
}

test.beforeEach(async ({ request }) => configure(request));

test("a direct review link opens the page that holds it and focuses the exact review", async ({ page }, testInfo) => {
  await page.goto(`/products/name-tag-shirt${reviewAnchor(1)}`);
  const target = page.locator(reviewAnchor(1));
  await expect(target).toBeFocused();
  await expect(target).toBeInViewport();
  await expect(target).toContainText("The oldest review has a public reply.");
  await expect(cards(page)).toHaveCount(20);
  await expect(page).toHaveURL(/[?&]reviewPage=2(&|#|$)/);
  await expect(pager(page)).toContainText("Showing 26–45 of 45 reviews");
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

test("a first-page review link reads nothing more", async ({ page }) => {
  const urls = reads(page);
  await page.goto(`/products/name-tag-shirt${reviewAnchor(45)}`);
  await expect(page.locator(reviewAnchor(45))).toBeFocused();
  await expect(cards(page)).toHaveCount(25);
  expect(urls).toHaveLength(0);
});

test("a review link never exposes content missing from the public pages", async ({ page, request }) => {
  await page.goto(`/products/name-tag-shirt${reviewAnchor(999)}`);
  await expect(page.getByRole("status").filter({ hasText: "This review is no longer available on this product page." })).toBeVisible();
  await expect(cards(page)).toHaveCount(25);
  await expect(page.locator(reviewAnchor(999))).toHaveCount(0);
  expect(await (await request.get(`${fixture}/__state`)).json()).toEqual({ privateOperationAttempts: 0 });
});

test("a failed review link lookup waits for a deliberate retry", async ({ page }) => {
  let retried = false;
  let failures = 0;
  await page.route("**/api/reviews/page?**", async (route) => {
    if (!retried) { failures += 1; await route.fulfill({ status: 503, json: { error: "Synthetic outage" } }); }
    else await route.continue();
  });
  await page.goto(`/products/name-tag-shirt${reviewAnchor(1)}`);
  await expect(page.locator("#reviews").getByRole("alert")).toContainText("Reviews couldn't load.");
  await expect(cards(page)).toHaveCount(25);
  await expect(page.getByRole("status").filter({ hasText: "This review is no longer available" })).toHaveCount(0);
  // Nothing retries on its own while the reader decides.
  const settled = failures;
  await page.waitForTimeout(500);
  expect(failures).toBe(settled);
  retried = true;
  await page.getByRole("button", { name: "Retry loading reviews", exact: true }).click();
  await expect(page.locator(reviewAnchor(1))).toBeFocused();
  await expect(page).toHaveURL(/[?&]reviewPage=2(&|#|$)/);
});

test("numbered pages reach every review while totals, JSON-LD and replies keep their scope", async ({ page }, testInfo) => {
  const urls = reads(page);
  await page.goto("/products/name-tag-shirt?reviewPage=1");
  await expect(cards(page)).toHaveCount(25);
  await expect(pager(page)).toContainText("Showing 1–25 of 45 reviews");
  await expect(pager(page).getByRole("button", { name: "Previous page" })).toBeDisabled();
  for (const width of [390, 1024, 1280, 1536]) {
    await page.setViewportSize({ width, height: 900 });
    await pager(page).scrollIntoViewIfNeeded();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await pager(page).screenshot({ path: testInfo.outputPath(`pagination-${width}.png`) });
  }
  await pager(page).getByRole("button", { name: "Next page" }).click();
  await expect(cards(page)).toHaveCount(20);
  await expect(cards(page).first()).toContainText("Fixture review 20");
  await expect(pager(page)).toContainText("Showing 26–45 of 45 reviews");
  await expect(page).toHaveURL(/[?&]reviewPage=2$/);
  // Changing page returns the reader to the top of the new cards.
  await expect(page.getByRole("region", { name: "Review results", exact: true })).toBeInViewport();
  await expect(pager(page).getByRole("button", { name: "Next page" })).toBeDisabled();
  await expect(page.locator("#reviews")).toContainText("Average rating from 45 reviews");
  expect(JSON.parse((await page.locator("#product-structured-data").textContent())!).aggregateRating.reviewCount).toBe(45);
  await expect(page.getByRole("article", { name: "Review by Ryan 1", exact: true })).toContainText("The oldest review has a public reply.");
  await expect(page.getByRole("article", { name: "Review by Ryan 1", exact: true }).getByText("Verified purchase", { exact: true })).toBeVisible();

  await pager(page).getByRole("button", { name: /^Per page/ }).click();
  await page.getByRole("option", { name: "10", exact: true }).click();
  await expect(cards(page)).toHaveCount(10);
  await expect(pager(page)).toContainText("Page 1 of 5");
  await expect(page).toHaveURL(/[?&]reviewPageSize=10$/);
  // A shared link opens the same page.
  await page.goto("/products/name-tag-shirt?reviewPage=3&reviewPageSize=10");
  await expect(cards(page).first()).toContainText("Fixture review 25");
  await expect(pager(page)).toContainText("Showing 21–30 of 45 reviews");
  expect(urls.map((url) => url.searchParams.get("productId"))).not.toContain(null);
});

test("a page past the end lands on the last page", async ({ page }) => {
  await page.goto("/products/name-tag-shirt?reviewPage=9");
  await expect(pager(page)).toContainText("Showing 26–45 of 45 reviews");
  await expect(page).toHaveURL(/[?&]reviewPage=2$/);
});

test("a failed page keeps the current reviews for a deliberate retry", async ({ page }) => {
  const pages: string[] = [];
  await page.route("**/api/reviews/page?**", async (route) => {
    pages.push(new URL(route.request().url()).searchParams.get("page")!);
    if (pages.length === 1) await route.fulfill({ status: 503, json: { error: "Synthetic outage" } });
    else await route.continue();
  });
  await page.goto("/products/name-tag-shirt?reviewPage=1");
  await pager(page).getByRole("button", { name: "Next page" }).click();
  await expect(page.locator("#reviews").getByRole("alert")).toContainText("Reviews couldn't load.");
  await expect(cards(page)).toHaveCount(25);
  await page.getByRole("button", { name: "Retry loading reviews", exact: true }).click();
  await expect(cards(page)).toHaveCount(20);
  expect(pages).toEqual(["2", "2"]);
});

test("a pending page shows skeleton cards, makes one request and disables paging", async ({ page }, testInfo) => {
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
    await page.goto("/products/name-tag-shirt?reviewPage=1");
    await pager(page).getByRole("button", { name: "Next page" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Finding matching reviews" })).toBeVisible();
    await expect(page.getByRole("region", { name: "Review results", exact: true })).toHaveAttribute("aria-busy", "true");
    await expect(pager(page).getByRole("button", { name: "Previous page" })).toBeDisabled();
    await page.screenshot({ path: testInfo.outputPath("pagination-mobile-pending.png") });
    expect(requests).toBe(1);
    release();
    await expect(cards(page)).toHaveCount(20);
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
    await page.goto("/products/name-tag-shirt?reviewPage=1");
    await pager(page).getByRole("button", { name: "Next page" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Finding matching reviews" })).toBeVisible();
    await page.getByRole("button", { name: /^Style/ }).click();
    await page.getByRole("option", { name: "Ryan’s Dad", exact: true }).click();
    release();
    await expect(cards(page)).toHaveCount(1);
    await expect(page.locator("#reviews")).not.toContainText("Fixture review 20");
  } finally { release(); }
});

test("filters and sorts read every match from storage and start again at page one", async ({ page, request }) => {
  await configureMixed(request);
  const urls = reads(page);
  await page.goto("/products/name-tag-shirt?reviewPage=2");
  await expect(cards(page)).toHaveCount(20);
  await choose(page, "Rating", "0.5–1 stars");
  await expect(cards(page)).toHaveCount(25);
  await expect(cards(page).first()).toContainText("Fixture review 25");
  await expect(pager(page)).toContainText("Showing 1–25 of 25 reviews");
  await expect(page).toHaveURL(/[?&]reviewRating=1$/);
  await expect(page.locator("#reviews")).toContainText("Average rating from 45 reviews");
  await choose(page, "Sort", "Oldest first");
  await expect(cards(page).first()).toContainText("Fixture review 1");
  await expect(cards(page).first()).toContainText("The oldest review has a public reply.");
  await choose(page, "Rating", "2.5–3 stars");
  await expect(cards(page)).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "No reviews match these filters" })).toBeVisible();
  await expect(pager(page)).toHaveCount(0);
  await page.getByRole("button", { name: "Reset filters", exact: true }).click();
  await expect(cards(page)).toHaveCount(25);
  await expect(cards(page).first()).toContainText("Fixture review 45");
  await expect(page.getByRole("button", { name: "Reset filters", exact: true })).toHaveCount(0);
  await choose(page, "Sort", "Lowest rated");
  await expect(cards(page).first()).toContainText("Fixture review 25");
  await choose(page, "Source", "Verified Etsy purchase");
  await expect(page.getByRole("heading", { name: "No reviews match these filters" })).toBeVisible();
  // The link's own page is read once; every filter and sort after it starts at page one.
  expect(urls[0].searchParams.get("page")).toBe("2");
  expect(urls.slice(1).map((url) => url.searchParams.get("page"))).not.toContain("2");
});

test("filter loading never presents stale matches as final and retries a failed read", async ({ page, request }) => {
  await configureMixed(request);
  let release!: () => void;
  const held = new Promise<void>((resolve) => { release = resolve; });
  const views: string[] = [];
  await page.route("**/api/reviews/page?**", async (route) => {
    const url = new URL(route.request().url());
    views.push(`${url.searchParams.get("rating")}/${url.searchParams.get("sort")}`);
    if (views.length === 1) { await held; return route.abort().catch(() => {}); }
    if (views.length === 2) await route.fulfill({ status: 503, json: { error: "Synthetic outage" } });
    else await route.continue();
  });
  try {
    await page.goto("/products/name-tag-shirt?reviewPage=1");
    await choose(page, "Rating", "0.5–1 stars");
    await expect(page.getByRole("status").filter({ hasText: "Finding matching reviews" })).toBeVisible();
    await expect(page.getByRole("region", { name: "Review results", exact: true })).toHaveAttribute("aria-busy", "true");
    await expect(cards(page)).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "No reviews match these filters" })).toHaveCount(0);
    // A newer choice replaces the read in flight.
    await choose(page, "Sort", "Oldest first");
    release();
    await expect(page.locator("#reviews").getByRole("alert")).toContainText("Reviews couldn't load.");
    await page.getByRole("button", { name: "Retry loading reviews", exact: true }).click();
    await expect(cards(page)).toHaveCount(25);
    await expect(cards(page).first()).toContainText("Fixture review 1");
    expect(views).toEqual(["1/null", "1/oldest", "1/oldest"]);
  } finally { release(); }
});

test("switching products clears the review view and ignores a pending response", async ({ page, request }) => {
  await configureMixed(request);
  let release!: () => void;
  const held = new Promise<void>((resolve) => { release = resolve; });
  await page.route("**/api/reviews/page?**", async (route) => {
    const response = await route.fetch();
    if (new URL(route.request().url()).searchParams.get("productId") === id(ryan)) await held;
    await route.fulfill({ response }).catch(() => {});
  });
  try {
    await page.goto("/products/name-tag-shirt?reviewPage=1");
    await choose(page, "Sort", "Oldest first");
    await expect(page.getByRole("status").filter({ hasText: "Finding matching reviews" })).toBeVisible();
    await page.getByRole("button", { name: /^Style/ }).click();
    await page.getByRole("option", { name: "Ryan’s Dad", exact: true }).click();
    await expect(cards(page)).toHaveCount(1);
    release();
    await expect(cards(page)).toHaveCount(1);
    await expect(page.getByRole("group", { name: "Filter and sort reviews" })).toContainText("Newest first");
    await expect(page.getByRole("button", { name: "Reset filters", exact: true })).toHaveCount(0);
  } finally { release(); }
});

test("review controls fit mobile and desktop boundaries", async ({ page, request }, testInfo) => {
  expect((await request.post(`${fixture}/__configure`, { data: { [id(ryan)]: dataset(ryan, 2) } })).ok()).toBe(true);
  await page.goto("/products/name-tag-shirt?reviewPage=1");
  await choose(page, "Sort", "Highest rated");
  const controls = page.getByRole("group", { name: "Filter and sort reviews" });
  for (const theme of ["dark"]) {
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


test("product reviews start with four cards and expand without another read", async ({ page }) => {
  const urls = reads(page);
  await page.goto("/products/name-tag-shirt");
  await expect(cards(page)).toHaveCount(4);
  await expect(pager(page)).toHaveCount(0);
  await expect(page.locator("#reviews")).toContainText("Average rating from 45 reviews");
  await page.getByRole("button", { name: "See all 45 reviews", exact: true }).click();
  await expect(cards(page)).toHaveCount(25);
  await expect(pager(page)).toContainText("Showing 1–25 of 45 reviews");
  expect(urls).toHaveLength(0);
  await page.reload();
  await expect(cards(page)).toHaveCount(25);
});

test("a linked review outside the preview expands the first page without refetching", async ({ page }) => {
  const urls = reads(page);
  await page.goto(`/products/name-tag-shirt${reviewAnchor(35)}`);
  await expect(page.locator(reviewAnchor(35))).toBeFocused();
  await expect(cards(page)).toHaveCount(25);
  expect(urls).toHaveLength(0);
});
