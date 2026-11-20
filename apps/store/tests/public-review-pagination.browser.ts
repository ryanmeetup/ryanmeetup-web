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

test.beforeEach(async ({ request }) => configure(request));

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

for (const change of ["product", "provider"] as const) {
  test(`a ${change} change discards a response from the previous review list`, async ({ page }) => {
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
      if (change === "product") {
        await page.getByRole("button", { name: /^Style/ }).click();
        await page.getByRole("option", { name: "Ryan’s Dad", exact: true }).click();
        await expect(cards(page)).toHaveCount(1);
      } else {
        await page.getByRole("button", { name: /^Review mode/ }).click();
        await page.getByRole("option", { name: "Judge.me", exact: true }).click();
        await expect(page.locator("#reviews")).toContainText("No reviews yet");
      }
      release();
      await expect(page.getByRole("button", { name: "Load more reviews", exact: true })).toHaveCount(0);
      await expect(cards(page)).toHaveCount(change === "product" ? 1 : 0);
      if (change === "product") {
        await page.goBack();
        await expect(cards(page)).toHaveCount(20);
        await expect(page.getByRole("button", { name: "Load more reviews", exact: true })).toBeEnabled();
      }
    } finally { release(); }
  });
}
