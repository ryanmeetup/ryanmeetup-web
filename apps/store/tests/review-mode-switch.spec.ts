import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

test.skip(process.env.REVIEWS_PREVIEW_ENABLED !== "true", "Requires a demo server with browser review testing enabled and Judge.me as the default.");

async function choose(page: Page, name: string) {
  await page.getByRole("button", { name: /^Review mode/ }).click();
  await page.getByRole("option", { name, exact: true }).click();
  await expect(page.getByRole("complementary", { name: "Review testing" })).toHaveAttribute("aria-busy", "false");
}

for (const theme of ["light", "dark"]) {
  for (const width of [390, 1024, 1280, 1536]) {
    test(`browser review switch works in ${theme} at ${width}px`, async ({ page }) => {
      await page.addInitScript((value) => localStorage.setItem("theme", value), theme);
      await page.setViewportSize({ width, height: 844 });
      await page.goto("/products/ryan-meetup-tee#reviews");
      const testing = page.getByRole("complementary", { name: "Review testing" });
      const trigger = page.getByRole("button", { name: "Write a review", exact: true });
      await expect(testing).toContainText("Using Judge.me.");
      await expect(trigger).toBeEnabled();
      await choose(page, "Custom reviews");
      await expect(testing).toContainText("Using custom reviews.");
      await expect(trigger).toBeDisabled();
      // Reviews load from the database, but writing waits for Shopify sign-in.
      await expect(page.locator("#reviews")).toContainText("Review collection is temporarily unavailable.");
      await page.reload();
      await expect(testing).toContainText("Using custom reviews.");
      await expect(trigger).toBeDisabled();
      await testing.screenshot({ path: `/private/tmp/store-review-switch-${theme}-${width}.png` });
      const bounds = await testing.boundingBox();
      expect(bounds).not.toBeNull();
      expect(bounds!.x).toBeGreaterThanOrEqual(0);
      expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width);
      await choose(page, "Judge.me");
      await expect(testing).toContainText("Using Judge.me.");
      await expect(trigger).toBeEnabled();
      await expect(page.locator("#reviews")).not.toContainText("Review collection is temporarily unavailable.");
      await choose(page, "Environment default");
      await expect(page.getByRole("button", { name: /^Review mode/ })).toContainText("Environment default");
      await expect.poll(async () => (await page.context().cookies()).some((cookie) => cookie.name === "store-review-preview")).toBe(false);
    });
  }
}

test("browser preference follows product navigation without changing another browser", async ({ page, browser }) => {
  await page.goto("/products/ryan-meetup-tee#reviews");
  await choose(page, "Custom reviews");
  await page.goto("/products/name-tag-shirt#reviews");
  await expect(page.getByRole("complementary", { name: "Review testing" })).toContainText("Using custom reviews.");
  await page.getByLabel(/^Style/).click();
  await page.getByRole("option", { name: "Ryan’s Dad", exact: true }).click();
  await expect(page.getByRole("button", { name: "Write a review", exact: true })).toBeDisabled();
  const other = await browser.newContext();
  try {
    const otherPage = await other.newPage();
    await otherPage.goto(new URL("/products/ryan-meetup-tee#reviews", page.url()).href);
    await expect(otherPage.getByRole("complementary", { name: "Review testing" })).toContainText("Using Judge.me.");
    await expect(otherPage.getByRole("button", { name: "Write a review", exact: true })).toBeEnabled();
  } finally {
    await other.close();
  }
});

test("a failed preference change leaves the current mode usable", async ({ page }) => {
  await page.goto("/products/ryan-meetup-tee#reviews");
  await page.route("**/api/reviews/preview", (route) => route.fulfill({ status: 503, json: { error: "Unavailable" } }));
  await choose(page, "Custom reviews");
  await expect(page.getByRole("complementary", { name: "Review testing" }).getByRole("alert")).toContainText("Could not switch review mode.");
  await expect(page.getByRole("complementary", { name: "Review testing" })).toContainText("Using Judge.me.");
  await expect(page.getByRole("button", { name: "Write a review", exact: true })).toBeEnabled();
});

test("the browser preference also closes direct submissions in custom mode", async ({ page }) => {
  await page.goto("/products/ryan-meetup-tee#reviews");
  await choose(page, "Custom reviews");
  const response = await page.request.post("/api/reviews", {
    headers: { origin: new URL(page.url()).origin },
    data: { productId: "gid://shopify/Product/123", lineId: "1", rating: 5, title: "Test", body: "Test", nameStyle: "first-initial" },
  });
  expect(response.status()).toBe(503);
  expect(await response.json()).toEqual({ error: "Review collection is temporarily unavailable. Please try again later." });
});
