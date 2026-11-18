import { expect, test } from "@playwright/test";
import type { Locator, Page } from "@playwright/test";
import { dad, tee } from "./fixtures/products";

async function openReview(page: Page) {
  await page.goto("/products/ryan-meetup-tee");
  await page.getByRole("button", { name: "Write a review", exact: true }).click();
  return page.getByRole("dialog", { name: "Write a review", exact: true });
}

async function fillReview(dialog: Locator, rating: number | null = 4) {
  if (rating !== null) {
    await dialog.getByRole("radio", { name: `${rating} stars`, exact: true }).check();
  }
  await dialog.getByRole("textbox", { name: /^Review/ }).fill("Comfortable gear for a very Ryan day.");
  await dialog.getByLabel("Display name").fill("Ryan");
  await dialog.getByLabel(/^Email/).fill("ryan@example.com");
}

test("the modal identifies the product, preserves the draft, and restores focus", async ({ page }) => {
  const dialog = await openReview(page);
  await expect(dialog.getByText(tee.title, { exact: true })).toBeVisible();
  await expect(dialog.getByLabel("Review title")).toHaveCount(0);
  await expect(dialog.getByRole("radiogroup", { name: "Rating" })).toContainText("Choose a rating");
  await expect(dialog.getByRole("radio", { checked: true })).toHaveCount(0);
  await fillReview(dialog);
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  const trigger = page.getByRole("button", { name: "Write a review", exact: true });
  await expect(trigger).toBeFocused();
  await trigger.click();
  await expect(dialog.getByRole("textbox", { name: /^Review/ })).toHaveValue("Comfortable gear for a very Ryan day.");
  await expect(dialog.getByLabel("Display name")).toHaveValue("Ryan");
  await expect(dialog.getByLabel(/^Email/)).toHaveValue("ryan@example.com");
  await expect(dialog.getByRole("radio", { name: "4 stars", exact: true })).toBeChecked();
});

test("a rating must be explicitly chosen before a review is submitted", async ({ page }) => {
  let submitted = false;
  await page.route("**/api/reviews", async (route) => {
    submitted = true;
    await route.fulfill({ json: { success: true } });
  });
  const dialog = await openReview(page);
  await fillReview(dialog, null);
  await dialog.getByRole("button", { name: "Submit review", exact: true }).click();
  await expect(dialog.getByRole("alert")).toContainText("Choose a rating");
  await expect(dialog.getByRole("radio", { name: "1 star", exact: true })).toBeFocused();
  expect(submitted).toBe(false);
});

test("submitting holds the dialog open, then announces success and clears its draft", async ({ page }) => {
  let finish: (() => void) | undefined;
  let submitted: Record<string, unknown> | undefined;
  await page.route("**/api/reviews", async (route) => {
    submitted = route.request().postDataJSON();
    await new Promise<void>((resolve) => { finish = resolve; });
    await route.fulfill({ json: { success: true } });
  });
  const dialog = await openReview(page);
  await fillReview(dialog, 4);
  await dialog.getByRole("button", { name: "Submit review", exact: true }).click();
  await expect(dialog.getByRole("button", { name: /Submitting/ })).toBeDisabled();
  await expect(dialog.getByRole("textbox", { name: /^Review/ })).toBeDisabled();
  await expect(dialog.getByRole("radio", { name: "4 stars", exact: true })).toBeDisabled();
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(1);
  await expect(dialog.getByRole("button", { name: /Submitting/ })).toBeVisible();
  await expect.poll(() => Boolean(finish)).toBe(true);
  finish!();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole("status").filter({ hasText: "Review received" })).toBeVisible();
  expect(submitted).toMatchObject({ rating: 4, name: "Ryan", email: "ryan@example.com", productId: tee.id });
  expect(submitted).not.toHaveProperty("title");
  await page.getByRole("button", { name: "Write a review", exact: true }).click();
  await expect(dialog.getByRole("textbox", { name: /^Review/ })).toBeEmpty();
  await expect(dialog.getByRole("radiogroup", { name: "Rating" })).toContainText("Choose a rating");
  await expect(dialog.getByRole("radio", { checked: true })).toHaveCount(0);
});

test("stars preview whole ratings without changing the saved selection", async ({ page }) => {
  const dialog = await openReview(page);
  const rating = dialog.getByRole("radiogroup", { name: "Rating" });
  const whole = rating.getByRole("radio", { name: "4 stars", exact: true });
  const five = rating.getByRole("radio", { name: "5 stars", exact: true });
  await whole.check();
  await five.hover();
  await expect(rating.getByText("5 out of 5", { exact: true })).toBeVisible();
  await expect(whole).toBeChecked();
  await dialog.getByRole("textbox", { name: /^Review/ }).hover();
  await expect(rating.getByText("Rated 4 out of 5", { exact: true })).toBeVisible();
  await five.check();
  await expect(five).toBeChecked();
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Write a review", exact: true }).click();
  await expect(five).toBeChecked();
});

test("keyboard arrows select whole stars with a full-star keyboard-only focus outline", async ({ page }) => {
  const dialog = await openReview(page);
  const four = dialog.getByRole("radio", { name: "4 stars", exact: true });
  await expect(dialog.getByRole("radio")).toHaveCount(5);
  await four.check();
  await expect(four.locator("../..")).toHaveCSS("outline-style", "none");
  await four.press("ArrowRight");
  const five = dialog.getByRole("radio", { name: "5 stars", exact: true });
  await expect(five).toBeChecked();
  await expect(five).toBeFocused();
  await expect(five.locator("../..")).toHaveCSS("outline-width", "2px");
  await expect(five.locator("..")).toHaveCSS("box-shadow", "none");
  await page.screenshot({ path: "/private/tmp/store-review-star-keyboard-focus.png" });
  await five.press("ArrowLeft");
  await expect(four).toBeChecked();
  await four.press("Tab");
  await expect(dialog.getByRole("textbox", { name: /^Review/ })).toBeFocused();
});

test("touch selects full stars", async ({ browser, baseURL }) => {
  const context = await browser.newContext({ baseURL, hasTouch: true, viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  const dialog = await openReview(page);
  const four = dialog.getByRole("radio", { name: "4 stars", exact: true });
  await four.tap();
  await expect(four).toBeChecked();
  const five = dialog.getByRole("radio", { name: "5 stars", exact: true });
  await five.tap();
  await expect(five).toBeChecked();
  await expect(dialog.getByRole("radiogroup", { name: "Rating" })).toContainText("5 out of 5");
  await context.close();
});

for (const failure of ["network", "invalid-json", "rejection"] as const) {
  test(`a ${failure} error keeps the draft and allows another attempt`, async ({ page }) => {
    let attempts = 0;
    await page.route("**/api/reviews", async (route) => {
      attempts += 1;
      if (attempts > 1) return route.fulfill({ json: { success: true } });
      if (failure === "network") return route.abort("failed");
      if (failure === "invalid-json") return route.fulfill({ status: 502, contentType: "text/plain", body: "Unavailable" });
      return route.fulfill({ status: 400, json: { error: "Please check your review." } });
    });
    const dialog = await openReview(page);
    await fillReview(dialog);
    await dialog.getByRole("button", { name: "Submit review", exact: true }).click();
    await expect(dialog.getByRole("alert")).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Submit review", exact: true })).toBeEnabled();
    await expect(dialog.getByRole("textbox", { name: /^Review/ })).toHaveValue("Comfortable gear for a very Ryan day.");
    await dialog.getByRole("button", { name: "Submit review", exact: true }).click();
    await expect(dialog).toHaveCount(0);
  });
}

test("switching designs reviews the selected Shopify product without transferring another product's draft", async ({ page }) => {
  await page.goto("/products/name-tag-shirt");
  const trigger = page.getByRole("button", { name: "Write a review", exact: true });
  await trigger.click();
  const dialog = page.getByRole("dialog", { name: "Write a review", exact: true });
  await dialog.getByRole("textbox", { name: /^Review/ }).fill("A review of the first design.");
  await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
  await page.getByLabel(/^Style/).click();
  await page.getByRole("option", { name: "Ryan’s Dad", exact: true }).click();
  await trigger.click();
  await expect(dialog.getByText(dad.title, { exact: true })).toBeVisible();
  await expect(dialog.getByRole("textbox", { name: /^Review/ })).toBeEmpty();
});

for (const theme of ["light", "dark"]) {
  for (const width of [390, 1024, 1280, 1536]) {
    test(`the ${theme} review dialog fits at ${width}px and keeps its actions visible`, async ({ page }) => {
      await page.addInitScript((value) => localStorage.setItem("theme", value), theme);
      await page.setViewportSize({ width, height: 844 });
      const dialog = await openReview(page);
      await dialog.getByRole("radio", { name: "4 stars", exact: true }).check();
      await dialog.getByRole("textbox", { name: /^Review/ }).focus();
      const submit = dialog.getByRole("button", { name: "Submit review", exact: true });
      const bounds = await dialog.locator("form").boundingBox();
      expect(bounds).not.toBeNull();
      expect(bounds!.x).toBeGreaterThanOrEqual(0);
      expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width);
      await expect(submit).toBeInViewport();
      await expect(dialog.getByRole("button", { name: "Cancel", exact: true })).toBeInViewport();
      if (width < 640) {
        expect(bounds!.y).toBe(0);
        expect(bounds!.height).toBe(844);
      }
      await page.screenshot({ path: `/private/tmp/store-review-${theme}-${width}.png` });
    });
  }
}
