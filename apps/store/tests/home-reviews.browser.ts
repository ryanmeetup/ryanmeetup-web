import { expect, test } from "@playwright/test";
import { summarizeReviewRatings } from "@ryanmeetup/reviews";
import { tee, dad } from "./fixtures/products";
const fixture = `http://127.0.0.1:${process.env.PRODUCT_REVIEW_FIXTURE_PORT ?? 54369}`;
const numeric = (id: string) => id.split("/").at(-1)!;
const summary = { count: 1, average: 4, distribution: { 1: 0, 2: 0, 3: 0, 4: 1, 5: 0 } };
const review = (n: number, product = tee) => ({
  id: `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`, rating: n === 8 ? 1 : 4,
  title: `Latest review ${n}`, body: "A real opinion about this shirt. ".repeat(8).trim(), displayName: `Ryan ${n}`,
  publishedAt: `2026-11-${String(10 + n).padStart(2, "0")}T12:00:00.000Z`, editedAt: null,
  item: { productId: numeric(product.id), productTitle: product.title, variantTitle: null }, verifiedPurchase: n % 2 === 0,
  photos: n === 8 ? [{ url: "/api/reviews/media/00000000-0000-4000-8000-000000000008/00000000-0000-4000-8000-000000000022/00000000-0000-4000-8000-000000000032", width: 48, height: 32 }] : [], reply: null,
});
test.beforeEach(async ({ request }) => {
  await request.post(`${fixture}/__configure`, { data: {
    [numeric(tee.id)]: { summary: summarizeReviewRatings([4,4,4,4]), reviews: [review(1), review(3), review(5), review(7)] },
    [numeric(dad.id)]: { summary: summarizeReviewRatings([4,4,4,1]), reviews: [review(2, dad), review(4, dad), review(6, dad), review(8, dad)] },
  } });
});

test("home ends with the six newest reviews across products, including low ratings and product links", async ({ page }) => {
  await page.goto("/");
  const section = page.getByRole("region", { name: "Recent reviews", exact: true });
  await expect(section.getByRole("heading", { level: 3 })).toHaveText([8, 7, 6, 5, 4, 3].map((n) => `Latest review ${n}`));
  await expect(page.locator("main > section").last()).toHaveAttribute("aria-labelledby", "home-reviews");
  await expect(section.getByRole("article", { name: "Review by Ryan 8", exact: true }).getByRole("img", { name: "1 out of 5 stars", exact: true })).toBeVisible();
  const card = section.getByRole("article", { name: "Review by Ryan 7", exact: true });
  await expect(card.getByText("Verified purchase", { exact: true })).toHaveCount(0);
  await section.getByRole("button", { name: "View photo 1 from Ryan 8", exact: true }).click();
  const photo = page.getByRole("dialog", { name: "Photo from Ryan 8", exact: true });
  await expect(photo.getByRole("img", { name: "Merch photo from Ryan 8's review", exact: true })).toBeVisible();
  await photo.getByRole("button", { name: "Close dialog", exact: true }).click();
  const link = section.getByRole("link", { name: `Review of ${tee.title}`, exact: true }).first();
  const target = (await link.getAttribute("href"))!;
  expect(target).not.toContain("#");
  await link.click();
  await expect(page).toHaveURL(new RegExp(`/products/[^#]+$`));
  await expect(page.locator("h1")).toBeInViewport();
  await page.goto("/");
  await page.getByRole("region", { name: "Recent reviews", exact: true }).getByRole("link", { name: `Review of ${dad.title}`, exact: true }).first().click();
  await expect(page).toHaveURL(/design=[^#]+$/);
  await expect(page.locator("h1")).toBeInViewport();
});

test("empty or failed public reads omit the showcase without losing the catalog", async ({ page, request }) => {
  for (const data of [{}, { [numeric(tee.id)]: { unavailable: true } }]) {
    await request.post(`${fixture}/__configure`, { data }); await page.goto("/");
    await expect(page.getByRole("heading", { name: /Merch with your/ })).toBeVisible();
    await expect(page.getByRole("region", { name: "Recent reviews", exact: true })).toHaveCount(0);
  }
});

test("a new request reflects moderation removal without a cached home feed", async ({ page, request }) => {
  await page.goto("/"); await expect(page.getByRole("heading", { name: "Latest review 8", exact: true })).toBeVisible();
  await request.post(`${fixture}/__configure`, { data: { [numeric(tee.id)]: { summary, reviews: [review(1)] } } });
  await page.reload(); await expect(page.getByRole("heading", { name: "Latest review 8", exact: true })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Latest review 1", exact: true })).toBeVisible();
});

for (const theme of ["light", "dark"]) for (const width of [390, 1024, 1280, 1536]) {
  test(`latest reviews fit ${theme} at ${width}px`, async ({ page }, testInfo) => {
    await page.addInitScript((value) => localStorage.setItem("theme", value), theme);
    await page.setViewportSize({ width, height: 1000 }); await page.goto("/");
    const section = page.getByRole("region", { name: "Recent reviews", exact: true });
    await section.scrollIntoViewIfNeeded(); await expect(section.getByRole("article")).toHaveCount(6);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await section.screenshot({ path: testInfo.outputPath(`home-reviews-${theme}-${width}.png`) });
  });
}
