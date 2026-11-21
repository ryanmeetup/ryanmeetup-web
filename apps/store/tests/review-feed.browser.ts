import { expect, test } from "@playwright/test";
import type { APIRequestContext, Page } from "@playwright/test";
import { summarizeReviewRatings } from "@ryanmeetup/reviews";
import { tee, dad } from "./fixtures/products";

const fixture = `http://127.0.0.1:${process.env.PRODUCT_REVIEW_FIXTURE_PORT ?? 54369}`;
const numeric = (id: string) => id.split("/").at(-1)!;
const cards = (page: Page) => page.locator('#review-feed > li');
const pager = (page: Page) => page.getByRole("navigation", { name: "reviews pagination" });
const reads = (page: Page) => {
  const urls: URL[] = [];
  page.on("request", (request) => { const url = new URL(request.url()); if (url.pathname === "/api/reviews/feed") urls.push(url); });
  return urls;
};

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

async function choose(page: Page, label: "Rating" | "Sort" | "Source", value: string) {
  await page.getByRole("group", { name: "Filter and sort reviews" }).getByRole("button", { name: new RegExp(`^${label}`) }).click();
  await page.getByRole("option", { name: value, exact: true }).click();
}

test.beforeEach(async ({ request }) => configure(request));

test("the shop feed pages by number, links across products and renders a shared page on the server", async ({ page, request }) => {
  await page.goto("/reviews");
  await expect(cards(page)).toHaveCount(25);
  await expect(cards(page).first()).toContainText("Shop review 46");
  await expect(pager(page)).toContainText("Showing 1–25 of 46 reviews");
  await pager(page).getByRole("button", { name: "Next page" }).click();
  await expect(cards(page)).toHaveCount(21);
  await expect(cards(page).first()).toContainText("Shop review 21");
  await expect(page).toHaveURL(/\/reviews\?page=2$/);
  await expect(pager(page).getByRole("button", { name: "Next page" })).toBeDisabled();
  for (const product of [tee, dad]) await expect(page.getByRole("link", { name: `Review of ${product.title}`, exact: true }).first()).toHaveAttribute("href", /^\/products\/[^#]+$/);
  await expect(page.getByRole("article", { name: "Review by Ryan 1", exact: true })).toBeVisible();

  const urls = reads(page);
  await page.goto("/reviews?page=2");
  await expect(cards(page)).toHaveCount(21);
  await expect(cards(page).first()).toContainText("Shop review 21");
  expect(urls).toHaveLength(0);
  expect(await (await request.get(`${fixture}/__state`)).json()).toEqual({ privateOperationAttempts: 0 });
});

test("ratings, sources and every sort are applied by storage across the whole feed", async ({ page }) => {
  await page.goto("/reviews");
  await choose(page, "Rating", "0.5–1 stars");
  await expect(cards(page)).toHaveCount(25);
  await expect(cards(page).first()).toContainText("Shop review 26");
  await expect(pager(page)).toContainText("Showing 1–25 of 26 reviews");
  await pager(page).getByRole("button", { name: "Next page" }).click();
  await expect(cards(page)).toHaveCount(1);
  await expect(cards(page).first()).toContainText("Shop review 1");
  await expect(page).toHaveURL(/[?&]page=2(&|$)/);
  await expect(page).toHaveURL(/[?&]rating=1(&|$)/);
  await choose(page, "Sort", "Oldest first");
  await expect(page).not.toHaveURL(/[?&]page=/);
  await expect(cards(page).first()).toContainText("Shop review 1");
  await expect(cards(page).first().getByRole("link", { name: `Review of ${tee.title}`, exact: true })).toHaveAttribute("href", `/products/${tee.handle}`);
  await choose(page, "Source", "Verified purchase");
  await expect(cards(page).first()).toContainText("Shop review 2");
  await expect(pager(page)).toContainText("of 13 reviews");
  await choose(page, "Rating", "2.5–3 stars");
  await expect(cards(page)).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "No reviews match these filters" })).toBeVisible();
  await page.getByRole("button", { name: "Reset filters", exact: true }).click();
  await expect(pager(page)).toContainText("Showing 1–25 of 46 reviews");
  await expect(cards(page).first()).toContainText("Shop review 46");
  await expect(page.getByRole("button", { name: "Reset filters", exact: true })).toHaveCount(0);
  await choose(page, "Sort", "Lowest rated");
  await expect(cards(page).first()).toContainText("Shop review 26");
  await choose(page, "Sort", "Highest rated");
  await expect(cards(page).first()).toContainText("Shop review 46");
});

test("a pending refinement shows skeletons, replaces an older read and retries a failed one", async ({ page }) => {
  let release!: () => void;
  const held = new Promise<void>((resolve) => { release = resolve; });
  const views: string[] = [];
  await page.route("**/api/reviews/feed?**", async (route) => {
    const url = new URL(route.request().url());
    views.push(`${url.searchParams.get("rating")}/${url.searchParams.get("sort")}`);
    if (views.length === 1) { await held; return route.abort().catch(() => {}); }
    if (views.length === 2) await route.fulfill({ status: 503, json: { error: "Synthetic outage" } });
    else await route.continue();
  });
  try {
    await page.goto("/reviews");
    await choose(page, "Rating", "0.5–1 stars");
    await expect(page.getByRole("region", { name: "Review results", exact: true })).toHaveAttribute("aria-busy", "true");
    await expect(page.getByRole("status").filter({ hasText: "Finding matching reviews" })).toBeVisible();
    await expect(cards(page)).toHaveCount(0);
    await expect(pager(page).getByRole("button", { name: "Next page" })).toBeDisabled();
    await choose(page, "Sort", "Oldest first");
    release();
    await expect(page.locator("main").getByRole("alert")).toContainText("Reviews couldn't load.");
    await expect(page.getByRole("heading", { name: "No reviews match these filters" })).toHaveCount(0);
    await page.getByRole("button", { name: "Retry loading reviews", exact: true }).click();
    await expect(cards(page)).toHaveCount(25);
    await expect(cards(page).first()).toContainText("Shop review 1");
    expect(views).toEqual(["1/null", "1/oldest", "1/oldest"]);
  } finally { release(); }
});

test("shop review controls and paging fit both themes at mobile and desktop boundaries", async ({ page }, testInfo) => {
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
        for (const name of [/^Rating/, /^Source/, /^Sort/, /^Reset filters$/]) {
          const bounds = await controls.getByRole("button", { name }).boundingBox();
          expect(bounds!.width).toBeGreaterThan(300);
        }
      }
      await page.locator("main").screenshot({ path: testInfo.outputPath(`shop-review-controls-${theme}-${width}.png`) });
      await pager(page).scrollIntoViewIfNeeded();
      await pager(page).screenshot({ path: testInfo.outputPath(`shop-review-pager-${theme}-${width}.png`) });
    }
  }
});

test("search debounces into the URL, searches every review and works from a shared link", async ({ page }) => {
  await page.goto("/reviews");
  const search = page.getByRole("textbox", { name: "Search reviews" });
  await expect(search).toHaveAttribute("placeholder", "Search by review, reviewer, or product...");
  // Review 7 sits on the second page, so a match proves storage searched the whole feed.
  await search.fill("shop review 7");
  await expect(cards(page)).toHaveCount(1);
  await expect(cards(page).first()).toContainText("Shop review 7");
  await expect(page).toHaveURL(/[?&]q=shop\+review\+7/);
  await choose(page, "Rating", "4.5–5 stars");
  await expect(cards(page)).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "No reviews match your search" })).toBeVisible();
  await page.getByRole("button", { name: "Clear search", exact: true }).click();
  await expect(search).toHaveValue("");
  await expect(cards(page)).toHaveCount(20);
  await expect(page).not.toHaveURL(/[?&]q=/);

  const urls = reads(page);
  await page.goto(`/reviews?q=${encodeURIComponent(dad.title)}`);
  await expect(search).toHaveValue(dad.title);
  await expect(cards(page)).toHaveCount(23);
  for (const row of await cards(page).all()) await expect(row).toContainText(dad.title);
  expect(urls).toHaveLength(0);
});
