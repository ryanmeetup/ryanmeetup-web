import { expect, test } from "@playwright/test";

// Run against a separate demo server built/started with REVIEWS_PROVIDER=custom.
// Keep the existing Judge.me/demo browser suite runnable against its own mode.
test.skip(process.env.REVIEWS_PROVIDER !== "custom", "Requires a custom-mode store server.");

for (const theme of ["light", "dark"]) {
  for (const width of [390, 1024, 1280, 1536]) {
    test(`custom reviews stay unavailable in ${theme} at ${width}px`, async ({ page }) => {
      await page.addInitScript((value) => localStorage.setItem("theme", value), theme);
      await page.setViewportSize({ width, height: 844 });
      await page.goto("/products/ryan-meetup-tee");
      const reviews = page.locator("#reviews");
      await expect(reviews.getByText("Reviews are temporarily unavailable.", { exact: true })).toBeVisible();
      await expect(reviews.getByRole("button", { name: "Write a review", exact: true })).toBeDisabled();
      await expect(reviews.getByText("Review collection is temporarily unavailable. Please try again later.")).toBeVisible();
      await expect(reviews.getByRole("heading", { name: "Reviews are taking a short break" })).toBeVisible();
      await expect(reviews).not.toContainText("No reviews yet");
      await expect(reviews).not.toContainText("Be the first to report back");
      await expect(page.getByRole("dialog", { name: "Write a review", exact: true })).toHaveCount(0);
      await expect(page.locator('script[type="application/ld+json"]')).not.toContainText("aggregateRating");
      const bounds = await reviews.boundingBox();
      expect(bounds).not.toBeNull();
      expect(bounds!.x).toBeGreaterThanOrEqual(0);
      expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width);
      await reviews.screenshot({ path: `/private/tmp/store-custom-review-${theme}-${width}.png` });
    });
  }
}

test("custom mode rejects direct submissions through the running server", async ({ request }) => {
  const response = await request.post("/api/reviews?provider=judgeme", {
    data: { productId: "gid://shopify/Product/123", rating: 5, body: "A test review", name: "Ryan", email: "ryan@example.com" },
  });
  expect(response.status()).toBe(503);
  expect(response.headers()["cache-control"]).toBe("no-store");
  expect(await response.json()).toEqual({ error: "Review collection is temporarily unavailable. Please try again later." });
});
