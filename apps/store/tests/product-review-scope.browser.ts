import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { dad, ryan, tee } from "./fixtures/products";
import type { Product } from "../lib/types";

const fixture = `http://127.0.0.1:${process.env.PRODUCT_REVIEW_FIXTURE_PORT ?? 54369}`;
const numericId = (product: Product) => product.id.split("/").at(-1)!;
const empty = { count: 0, average: 0, distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 } };
const ryanSummary = { count: 25, average: 4.4, distribution: { 1: 0, 2: 0, 3: 0, 4: 15, 5: 10 } };
const dadSummary = { count: 3, average: 2, distribution: { 1: 1, 2: 1, 3: 1, 4: 0, 5: 0 } };

function review(product: Product, rating: number) {
  return {
    id: "00000000-0000-4000-8000-000000000001", rating, title: `A review of ${product.title}`, body: "Synthetic public review.", displayName: "Ryan F.",
    publishedAt: "2026-11-18T12:00:00.000Z", editedAt: null,
    item: { productId: numericId(product), productTitle: product.title, variantTitle: null },
    verifiedPurchase: true, photos: [], reply: null,
  };
}

async function schema(page: Page) {
  // The page also carries a breadcrumb JSON-LD block; only the product schema holds ratings.
  const scripts = page.locator('script#product-structured-data[type="application/ld+json"]');
  await expect(scripts).toHaveCount(1);
  return JSON.parse((await scripts.textContent())!);
}

test.beforeEach(async ({ request }) => {
  expect((await request.post(`${fixture}/__configure`, { data: {
    [numericId(ryan)]: { summary: ryanSummary, reviews: [review(ryan, 4)] },
    [numericId(dad)]: { summary: dadSummary, reviews: [review(dad, 2)] },
    [numericId(tee)]: { summary: ryanSummary, reviews: [review(tee, 4)] },
  } })).ok()).toBe(true);
});

test("server HTML and hydrated style changes keep ratings scoped to the selected design", async ({ page, request }) => {
  const response = await request.get(`/products/name-tag-shirt?design=${dad.handle}`);
  const html = await response.text();
  const source = html.match(/<script id="product-structured-data" type="application\/ld\+json">([^<]+)<\/script>/);
  expect(source).not.toBeNull();
  expect(JSON.parse(source![1]).aggregateRating).toEqual({ "@type": "AggregateRating", ratingValue: "2.0", reviewCount: 3, bestRating: 5, worstRating: 0.5 });

  await page.goto("/products/name-tag-shirt");
  await expect(page.locator("#reviews")).toContainText("Average rating from 25 reviews");
  await expect.poll(async () => (await schema(page)).aggregateRating).toMatchObject({ ratingValue: "4.4", reviewCount: 25 });
  await page.getByRole("button", { name: /^Style/ }).click();
  await page.getByRole("option", { name: "Ryan’s Dad", exact: true }).click();
  await expect(page.locator("#reviews")).toContainText("Average rating from 3 reviews");
  await expect.poll(async () => (await schema(page)).aggregateRating).toMatchObject({ ratingValue: "2.0", reviewCount: 3 });
  const selected = await schema(page);
  const offers = selected.offers ? [selected.offers] : selected.hasVariant.map((variant: { offers: unknown }) => variant.offers);
  expect(offers.length).toBeGreaterThan(0);
  for (const offer of offers) expect(offer.url).toContain(`design=${dad.handle}`);
  await page.goBack();
  await expect(page.locator("#reviews")).toContainText("Average rating from 25 reviews");
  await expect.poll(async () => (await schema(page)).aggregateRating.reviewCount).toBe(25);
  await page.goForward();
  await expect.poll(async () => (await schema(page)).aggregateRating.reviewCount).toBe(3);
});

for (const state of ["unavailable", "empty"] as const) {
  test(`a selected design with ${state} reviews never borrows another design's rating`, async ({ page, request }) => {
    await request.post(`${fixture}/__configure`, { data: {
      [numericId(ryan)]: { summary: ryanSummary, reviews: [review(ryan, 4)] },
      [numericId(dad)]: state === "unavailable" ? { unavailable: true } : { summary: empty, reviews: [] },
    } });
    await page.goto(`/products/name-tag-shirt?design=${dad.handle}`);
    await expect(page.locator("#reviews")).toContainText(state === "unavailable" ? "Reviews are temporarily unavailable." : "No reviews yet");
    expect(await schema(page)).not.toHaveProperty("aggregateRating");
    await page.getByRole("button", { name: /^Style/ }).click();
    await page.getByRole("option", { name: "Ryan", exact: true }).click();
    await expect.poll(async () => (await schema(page)).aggregateRating?.reviewCount).toBe(25);
  });
}

test("ungrouped products retain their own complete rating summary", async ({ page }) => {
  await page.goto(`/products/${tee.handle}`);
  await expect(page.locator("#reviews")).toContainText("Average rating from 25 reviews");
  expect((await schema(page)).aggregateRating).toMatchObject({ ratingValue: "4.4", reviewCount: 25 });
});

test("published unverified custom reviews remain visible without a purchase or legacy verification badge", async ({ page, request }) => {
  const verified = review(tee, 4);
  const unverified = { ...verified, id: "00000000-0000-4000-8000-000000000002", displayName: "Another Ryan", verifiedPurchase: false };
  expect((await request.post(`${fixture}/__configure`, { data: {
    [numericId(tee)]: { summary: { count: 2, average: 4, distribution: { 1: 0, 2: 0, 3: 0, 4: 2, 5: 0 } }, reviews: [verified, unverified] },
  } })).ok()).toBe(true);
  await page.goto(`/products/${tee.handle}#reviews`);
  await expect(page.getByRole("article", { name: "Review by Ryan F.", exact: true }).getByText("Verified purchase", { exact: true })).toBeVisible();
  const card = page.getByRole("article", { name: "Review by Another Ryan", exact: true });
  await expect(card).toContainText("Synthetic public review.");
  await expect(card.getByText(/Verified (purchase|review)/)).toHaveCount(0);
  await expect(page.locator("#reviews")).toContainText("Average rating from 2 reviews");
});

test("pausing custom collection keeps published reviews readable and refuses buyer operations before private storage", async ({ page, request, baseURL }) => {
  await page.goto(`/products/${tee.handle}`);
  await expect(page.locator("#reviews")).toContainText("Average rating from 25 reviews");
  await expect(page.locator("#reviews").getByRole("button", { name: "Write a review", exact: true })).toBeDisabled();
  expect((await schema(page)).aggregateRating.reviewCount).toBe(25);

  const headers = { origin: baseURL!, accept: "application/json" };
  const submission = { rating: 4, title: "Ryan approved", body: "A synthetic review.", nameStyle: "first-initial" };
  const version = { reviewId: "00000000-0000-4000-8000-000000000001", expectedUpdatedAt: "2026-11-18T12:00:00.000000Z" };
  const responses = await Promise.all([
    request.get("/api/reviews/auth/start?returnTo=/reviews/mine", { headers }),
    request.get("/api/reviews/mine", { headers }),
    request.post("/api/reviews", { headers, data: { ...submission, productId: tee.id, lineId: "1" } }),
    request.post("/api/reviews/mine", { headers, data: { action: "edit", ...version, ...submission } }),
    request.post("/api/reviews/mine", { headers, data: { action: "withdraw", ...version } }),
  ]);
  for (const response of responses) {
    expect(response.status()).toBe(503);
    expect(response.headers()["cache-control"]).toContain("no-store");
  }
  expect(await (await request.get(`${fixture}/__state`)).json()).toEqual({ privateOperationAttempts: 0 });
  await page.reload();
  await expect(page.locator("#reviews")).toContainText("Average rating from 25 reviews");
});

test("approved review photos use the uncached Store route and an old URL is revoked", async ({ page, request, baseURL }, testInfo) => {
  const image = { url: "/api/reviews/media/00000000-0000-4000-8000-000000000001/00000000-0000-4000-8000-000000000002/00000000-0000-4000-8000-000000000003", width: 48, height: 32 };
  await request.post(`${fixture}/__configure`, { data: { [numericId(tee)]: { summary: { count: 1, average: 4, distribution: {1:0,2:0,3:0,4:1,5:0} }, reviews: [{ ...review(tee,4), photos: [image] }] } } });
  await page.goto(`/products/${tee.handle}#reviews`);
  const thumbnail = page.getByRole("img", { name: "Photo 1 from Ryan F.'s review", exact: true });
  await expect(thumbnail).toBeVisible();
  const source = new URL((await thumbnail.getAttribute("src"))!, baseURL);
  expect(source.origin).toBe(baseURL); expect(source.pathname).toBe(image.url); expect(source.search).toBe("");
  const response = await request.get(image.url);
  expect(response.status()).toBe(200); expect(response.headers()["cache-control"]).toBe("no-store");
  expect(response.headers()["content-type"]).toBe("image/webp");
  expect(response.headers()["referrer-policy"]).toBe("no-referrer");
  await page.getByRole("button", { name: "View photo 1 from Ryan F.", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Photo from Ryan F.", exact: true });
  await expect(dialog.getByRole("heading", { name: "Photo from Ryan F." })).toBeVisible();
  const enlarged = dialog.getByRole("img", { name: "Merch photo from Ryan F.'s review", exact: true });
  await expect(enlarged).toBeVisible();
  await expect.poll(() => enlarged.evaluate((image) => (image as HTMLImageElement).naturalWidth)).toBe(48);
  for (const width of [390, 1024, 1280, 1536]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath(`public-photo-${width}.png`) });
  }
  await request.post(`${fixture}/__configure`, { data: { [numericId(tee)]: { summary: empty, reviews: [] } } });
  expect((await request.get(image.url)).status()).toBe(404);
});
