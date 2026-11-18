import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { parseReviewPreviewChoice, resolveReviewProvider } from "../lib/review-provider";

test.describe("sample buyer preview choice", () => {
  const env = { ...process.env };
  test.afterEach(() => { process.env = { ...env }; });

  test("reads custom reviews, but only where browser testing is allowed", () => {
    expect(parseReviewPreviewChoice("custom-sample")).toBe("custom-sample");
    process.env.REVIEWS_PROVIDER = "judgeme";
    process.env.REVIEWS_PREVIEW_ENABLED = "true";
    delete process.env.VERCEL_ENV;
    expect(resolveReviewProvider("custom-sample")).toBe("custom");
    process.env.VERCEL_ENV = "production";
    expect(resolveReviewProvider("custom-sample")).toBe("judgeme");
  });
});

const browser = process.env.REVIEWS_PREVIEW_ENABLED === "true";
// The demo catalog's tee by default; set REVIEW_TEST_PRODUCT to test against a live catalog.
const productPath = `${process.env.REVIEW_TEST_PRODUCT ?? "/products/ryan-meetup-tee"}#reviews`;

async function choose(page: Page, name: string) {
  const option = page.getByRole("option", { name, exact: true });
  // A dev server can still be hydrating on the first click; retry until the menu opens.
  await expect(async () => {
    if (!(await option.isVisible())) await page.getByRole("button", { name: /^Review mode/ }).click();
    await expect(option).toBeVisible({ timeout: 2000 });
  }).toPass({ timeout: 60_000 });
  await option.click();
  await expect(page.getByRole("complementary", { name: "Review testing" })).toHaveAttribute("aria-busy", "false");
}

for (const theme of ["light", "dark"]) {
  for (const width of [390, 1024, 1280, 1536]) {
    test(`sample buyer can write a review in ${theme} at ${width}px`, async ({ page }) => {
      test.skip(!browser, "Requires a demo server with browser review testing enabled.");
      await page.addInitScript((value) => localStorage.setItem("theme", value), theme);
      await page.setViewportSize({ width, height: 844 });
      await page.goto(productPath);
      await choose(page, "Custom reviews, sample buyer");
      const reviews = page.locator("#reviews");
      await expect(reviews).toContainText("Sample buyer: nothing is saved.");

      await reviews.getByRole("button", { name: "Write a review", exact: true }).click();
      const dialog = page.getByRole("dialog", { name: "Write a review", exact: true });
      await expect(dialog).toContainText("Reviewing Sample order");
      await expect(dialog).toContainText("Shown publicly as Ryan S.");
      await expect(dialog.getByLabel("Email")).toHaveCount(0);

      await dialog.getByRole("button", { name: /^Show my name as/ }).click();
      await page.getByRole("option", { name: "Full name: Ryan Sample", exact: true }).click();
      await expect(dialog).toContainText("Shown publicly as Ryan Sample");

      await dialog.getByRole("radio", { name: "5 stars", exact: true }).check();
      await dialog.getByLabel("Title").fill("  Fits like a Ryan ");
      await dialog.getByLabel(/^Review/).fill("Washed it twice and the name tag still pops.");
      // The dialog element itself has no box; measure and capture its visible form.
      const submit = dialog.getByRole("button", { name: "Submit review", exact: true });
      await expect(submit).toBeVisible();
      await page.screenshot({ path: `/private/tmp/store-custom-composer-${theme}-${width}.png` });
      const bounds = await dialog.locator("form").boundingBox();
      expect(bounds!.x).toBeGreaterThanOrEqual(0);
      expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width);

      await dialog.getByRole("button", { name: "Submit review", exact: true }).click();
      await expect(dialog).toHaveCount(0);
      await expect(reviews.getByRole("status").filter({ hasText: "Review received" })).toContainText("Sample review checked. Nothing was saved");
      await choose(page, "Environment default");
    });
  }
}

test("the sample buyer must pick a rating before submitting", async ({ page }) => {
  test.skip(!browser, "Requires a demo server with browser review testing enabled.");
  await page.goto(productPath);
  await choose(page, "Custom reviews, sample buyer");
  await page.locator("#reviews").getByRole("button", { name: "Write a review", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Write a review", exact: true });
  await dialog.getByLabel(/^Review/).fill("No stars yet.");
  await dialog.getByRole("button", { name: "Submit review", exact: true }).click();
  await expect(dialog.getByText("Choose a rating before submitting your review.")).toBeVisible();
  await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await choose(page, "Environment default");
});

test("plain custom mode keeps the form closed", async ({ page }) => {
  test.skip(!browser, "Requires a demo server with browser review testing enabled.");
  await page.goto(productPath);
  await choose(page, "Custom reviews");
  await expect(page.locator("#reviews").getByRole("button", { name: "Write a review", exact: true })).toBeDisabled();
  await expect(page.locator("#reviews")).toContainText("Review collection is temporarily unavailable.");
  await choose(page, "Environment default");
});
