import { expect, test } from "@playwright/test";
import type { APIRequestContext } from "@playwright/test";
import type { PublicReviewReply } from "@ryanmeetup/reviews";
import { tee } from "./fixtures/products";

const fixture = `http://127.0.0.1:${process.env.PRODUCT_REVIEW_FIXTURE_PORT ?? 54369}`;
const productId = tee.id.split("/").at(-1)!;
const label = "Reply from Ryan Meetup";
const publishedAt = "2026-11-18T00:30:00.000Z";
const html = '<img src="x" onerror="window.replyExecuted=true">';
const body = `Thanks for sharing your feedback.\n\n${html}\n\n${"Ryan".repeat(120)}`;

async function configure(request: APIRequestContext, reply: PublicReviewReply | null) {
  const response = await request.post(`${fixture}/__configure`, { data: {
    [productId]: {
      summary: { count: 1, average: 4, distribution: { 1: 0, 2: 0, 3: 0, 4: 1, 5: 0 } },
      reviews: [{
        id: "00000000-0000-4000-8000-000000000001", rating: 4, title: "Ryan approved", body: "A synthetic customer review.",
        displayName: "Ryan F.", publishedAt: "2026-11-17T12:00:00.000Z", editedAt: null,
        item: { productId, productTitle: tee.title, variantTitle: null }, verifiedPurchase: true, photos: [], reply,
      }],
    },
  } });
  expect(response.ok()).toBe(true);
}

test.use({ timezoneId: "America/New_York" });

for (const theme of ["light", "dark"]) {
  for (const width of [390, 1024, 1280, 1536]) {
    test(`public replies render safely in ${theme} at ${width}px`, async ({ page, request }, testInfo) => {
      await configure(request, { body, publishedAt });
      await page.addInitScript((theme) => localStorage.setItem("theme", theme), theme);
      await page.setViewportSize({ width, height: 900 });
      await page.goto(`/products/${tee.handle}#reviews`);
      const article = page.getByRole("article", { name: "Review by Ryan F.", exact: true });
      await expect(article.getByText("Verified purchase", { exact: true })).toBeVisible();
      await expect(article.getByText("Verified review", { exact: true })).toHaveCount(0);
      const response = article.getByRole("region", { name: label, exact: true });
      await expect(response.getByRole("heading", { name: label, level: 4 })).toBeVisible();
      await expect(response.locator("time")).toHaveAttribute("datetime", publishedAt);
      await expect(response.locator("time")).toHaveText("Nov 18, 2026");
      expect(await response.locator("p").textContent()).toBe(body);
      await expect(response.locator("p")).toHaveCSS("white-space", "pre-wrap");
      await expect(response.locator("img, script")).toHaveCount(0);
      expect(await page.evaluate(() => "replyExecuted" in window)).toBe(false);
      expect(await response.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      await article.screenshot({ path: testInfo.outputPath(`public-reply-${theme}-${width}.png`) });
    });
  }
}

test("updated and removed replies follow the next public read without affecting the review or its rating", async ({ page, request }) => {
  await configure(request, { body: "Thanks for reporting back.", publishedAt });
  await page.goto(`/products/${tee.handle}#reviews`);
  const response = page.getByRole("region", { name: label, exact: true });
  await expect(response).toContainText("Thanks for reporting back.");
  await configure(request, { body: "We updated our answer.", publishedAt });
  await page.reload();
  await expect(response).toContainText("We updated our answer.");
  await expect(response).not.toContainText("Thanks for reporting back.");
  await configure(request, null);
  await page.reload();
  await expect(response).toHaveCount(0);
  await expect(page.getByRole("article", { name: "Review by Ryan F.", exact: true })).toContainText("A synthetic customer review.");
  await expect(page.locator("#reviews")).toContainText("Average rating from 1 review");
});
