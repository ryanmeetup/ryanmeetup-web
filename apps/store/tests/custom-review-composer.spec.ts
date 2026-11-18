import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { parseReviewPreviewChoice, resolveReviewProvider, reviewPreviewCookie } from "../lib/review-provider";
import { isTestBuyerRequest } from "../lib/review-test-buyer";

test.describe("test buyer preview choice", () => {
  const env = { ...process.env };
  test.afterEach(() => { process.env = { ...env }; });

  test("reads custom reviews, but only where browser testing is allowed", () => {
    expect(parseReviewPreviewChoice("custom-test")).toBe("custom-test");
    process.env.REVIEWS_PROVIDER = "judgeme";
    process.env.REVIEWS_PREVIEW_ENABLED = "true";
    delete process.env.VERCEL;
    expect(resolveReviewProvider("custom-test", "localhost:3102")).toBe("custom");
    expect(resolveReviewProvider("custom-test", "store.ryanmeetup.com")).toBe("judgeme");
    process.env.VERCEL = "1";
    expect(resolveReviewProvider("custom-test", "localhost:3102")).toBe("judgeme");
  });

  test("saves as the test buyer only on localhost with the test buyer chosen", () => {
    const request = (host: string, choice = "custom-test") => new Request(`http://${host}/api/reviews`, { headers: { host, cookie: `${reviewPreviewCookie}=${choice}` } });
    process.env.REVIEWS_PREVIEW_ENABLED = "true";
    delete process.env.VERCEL;
    expect(isTestBuyerRequest(request("localhost:3102"))).toBe(true);
    expect(isTestBuyerRequest(request("localhost:3102", "custom"))).toBe(false);
    expect(isTestBuyerRequest(request("store.ryanmeetup.com"))).toBe(false);
    process.env.VERCEL = "1";
    expect(isTestBuyerRequest(request("localhost:3102"))).toBe(false);
  });
});

// Each test gets fresh cookies, so no test needs to reset the review mode afterwards.
// Test-buyer reviews are saved to the suite's synthetic Supabase; start each test empty.
const fakeSupabase = `http://127.0.0.1:${process.env.FAKE_SUPABASE_PORT ?? 54360}`;
test.beforeEach(async ({ request }) => {
  if (!process.env.STORE_BASE_URL) expect((await request.post(`${fakeSupabase}/__reset`, { data: { empty: true } })).ok()).toBeTruthy();
});
const browser = process.env.REVIEWS_PREVIEW_ENABLED === "true";
// The demo catalog's tee by default; set REVIEW_TEST_PRODUCT to test against a live catalog.
const productPath = `${process.env.REVIEW_TEST_PRODUCT ?? "/products/ryan-meetup-tee"}#reviews`;

async function choose(page: Page, name: string) {
  const option = page.getByRole("option", { name, exact: true });
  // A dev server can still be hydrating, or re-rendering after the last switch,
  // which can close the menu mid-click; retry opening and choosing together.
  await expect(async () => {
    if (!(await option.isVisible())) await page.getByRole("button", { name: /^Review mode/ }).click();
    await option.click({ timeout: 2000 });
  }).toPass({ timeout: 60_000 });
  await expect(page.getByRole("button", { name: /^Review mode/ })).toContainText(name);
  await expect(page.getByRole("complementary", { name: "Review testing" })).toHaveAttribute("aria-busy", "false");
}

for (const theme of ["light", "dark"]) {
  for (const width of [390, 1024, 1280, 1536]) {
    test(`test buyer can write and save a review in ${theme} at ${width}px`, async ({ page }) => {
      test.skip(!browser, "Requires a demo server with browser review testing enabled.");
      await page.addInitScript((value) => localStorage.setItem("theme", value), theme);
      await page.setViewportSize({ width, height: 844 });
      await page.goto(productPath);
      await choose(page, "Custom reviews, test buyer");
      const reviews = page.locator("#reviews");
      await expect(reviews).toContainText("Test buyer: reviews are saved and wait for approval.");

      await reviews.getByRole("button", { name: "Write a review", exact: true }).click();
      const dialog = page.getByRole("dialog", { name: "Write a review", exact: true });
      await expect(dialog).toContainText("Reviewing Test order");
      await expect(dialog).toContainText("Shown publicly as Ryan T.");
      await expect(dialog.getByLabel("Email")).toHaveCount(0);

      await dialog.getByRole("button", { name: /^Show my name as/ }).click();
      await page.getByRole("option", { name: "Full name: Ryan Tester", exact: true }).click();
      await expect(dialog).toContainText("Shown publicly as Ryan Tester");

      await dialog.getByRole("radio", { name: "5 stars", exact: true }).check();
      await dialog.getByLabel(/^Title/).fill("  Fits like a Ryan ");
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
      await expect(reviews.getByRole("status").filter({ hasText: "Review received" })).toContainText("Thanks! Your review is waiting for approval.");
    });
  }
}

test("the test buyer must pick a rating before submitting", async ({ page }) => {
  test.skip(!browser, "Requires a demo server with browser review testing enabled.");
  await page.goto(productPath);
  await choose(page, "Custom reviews, test buyer");
  await page.locator("#reviews").getByRole("button", { name: "Write a review", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Write a review", exact: true });
  await dialog.getByLabel(/^Review/).fill("No stars yet.");
  await dialog.getByRole("button", { name: "Submit review", exact: true }).click();
  await expect(dialog.getByText("Choose a rating before submitting your review.")).toBeVisible();
});

test("the test buyer's only purchase is implied after switching from plain custom mode", async ({ page }) => {
  test.skip(!browser, "Requires a demo server with browser review testing enabled.");
  await page.goto(productPath);
  // Plain custom mode mounts the composer closed; switching refreshes it without a remount.
  await choose(page, "Custom reviews");
  await choose(page, "Custom reviews, test buyer");
  const reviews = page.locator("#reviews");
  await expect(reviews).toContainText("Test buyer: reviews are saved and wait for approval.");
  await reviews.getByRole("button", { name: "Write a review", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Write a review", exact: true });
  await dialog.getByRole("radio", { name: "5 stars", exact: true }).check();
  await dialog.getByLabel(/^Title/).fill("Super Ryan");
  await dialog.getByLabel(/^Review/).fill("This was a good shirt!");
  await dialog.getByRole("button", { name: "Submit review", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(reviews.getByRole("status").filter({ hasText: "Review received" })).toContainText("Thanks! Your review is waiting for approval.");
  if (process.env.STORE_BASE_URL) return;
  const { calls } = await (await page.request.get(`${fakeSupabase}/__state`)).json();
  expect(calls).toEqual([expect.objectContaining({
    operation: "review.submit", subject: "local-test-buyer", displayName: "Ryan T.",
    submission: { rating: 5, title: "Super Ryan", body: "This was a good shirt!", nameStyle: "first-initial" },
  })]);
  // The same purchase can't be reviewed twice.
  await page.reload();
  await reviews.getByRole("button", { name: "Write a review", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "You've already reviewed this", exact: true }).getByText("Each purchase gets one review")).toBeVisible();
});

test("the test buyer must give the review a title", async ({ page }) => {
  test.skip(!browser, "Requires a demo server with browser review testing enabled.");
  await page.goto(productPath);
  await choose(page, "Custom reviews, test buyer");
  await page.locator("#reviews").getByRole("button", { name: "Write a review", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Write a review", exact: true });
  await expect(dialog.getByLabel(/^Title/)).toHaveAttribute("required", "");
  await dialog.getByRole("radio", { name: "5 stars", exact: true }).check();
  await dialog.getByLabel(/^Title/).fill("   ");
  await dialog.getByLabel(/^Review/).fill("No headline.");
  await dialog.getByRole("button", { name: "Submit review", exact: true }).click();
  await expect(dialog.getByText(/^Give your review a title/)).toBeVisible();
});

test("plain custom mode keeps the form closed", async ({ page }) => {
  test.skip(!browser, "Requires a demo server with browser review testing enabled.");
  await page.goto(productPath);
  await choose(page, "Custom reviews");
  await expect(page.locator("#reviews").getByRole("button", { name: "Write a review", exact: true })).toBeDisabled();
  await expect(page.locator("#reviews")).toContainText("Review collection is temporarily unavailable.");
});
