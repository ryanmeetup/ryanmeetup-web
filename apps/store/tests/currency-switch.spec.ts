import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { currencyStorageKey } from "../lib/currency";

const rates = { date: "2026-11-04", rates: { USD: 1, EUR: 0.9, GBP: 0.75, CAD: 1.4, AUD: 1.5 } };
const option = (page: Page, code: string) => page.getByRole("menuitem", { name: new RegExp(`^${code}`) });

test("homepage currency menus switch all badges without following links and remember the choice", async ({ page }) => {
  let requests = 0;
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.route("**/api/currency-rates", (route) => {
    requests += 1;
    return route.fulfill({ json: rates });
  });
  await page.goto("/");
  const badges = page.getByRole("main").locator("p.bg-price");
  const count = await badges.count();
  expect(count).toBeGreaterThan(1);
  const first = badges.first().getByRole("button");
  expect(await first.evaluate((button) => button.closest("a"))).toBeNull();
  expect(requests).toBe(0);

  await expect(badges.getByRole("button")).toHaveText(Array(count).fill("USD"));
  for (const currency of ["GBP", "AUD", "USD", "EUR"]) {
    await first.click();
    await option(page, currency).click();
    await expect(page.getByRole("menu")).toBeHidden();
    await expect(badges.getByRole("button")).toHaveText(Array(count).fill(currency));
    await expect(page).toHaveURL(/\/$/);
  }
  expect(requests).toBe(1);
  expect(await page.evaluate((key) => localStorage.getItem(key), currencyStorageKey)).toBe("EUR");

  await page.getByRole("main").getByRole("link", { name: /Official Ryan Meetup Tee/ }).first().click();
  await expect(page).toHaveURL(/\/products\/ryan-meetup-tee$/);
  const price = page.getByRole("main").locator('[aria-live="polite"] > p');
  await expect(price).toContainText("≈€26.10 EUR");
  await expect(price.getByText("Estimated · checkout in USD")).toBeVisible();
  expect(requests).toBe(1);

  await page.reload();
  await expect(price).toContainText("≈€26.10 EUR");
  expect(requests).toBe(2);
  expect(errors).toEqual([]);
});

test("keyboard currency selection converts both sale prices and leaves cart money in USD", async ({ page }) => {
  await page.route("**/api/currency-rates", (route) => route.fulfill({ json: rates }));
  await page.goto("/products/ryan-society-cap");
  const price = page.getByRole("main").locator('[aria-live="polite"] > p');
  const currency = price.getByRole("button");
  await currency.focus();
  await page.keyboard.press("Enter");
  await expect(option(page, "USD")).toHaveAttribute("data-focus");
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  await expect(price).toContainText("≈€23.40 EUR, originally €28.80");
  await expect(currency).toBeFocused();
  await expect(page.getByRole("menu")).toBeHidden();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("menu")).toBeVisible();
  await page.keyboard.type("g");
  await expect(option(page, "GBP")).toHaveAttribute("data-focus");
  await page.keyboard.press("Enter");
  await expect(price).toContainText("≈£19.50 GBP, originally £24.00");
  await expect(currency).toBeFocused();

  await page.getByRole("main").getByRole("button", { name: "Add to cart" }).click();
  await expect(page.getByRole("dialog", { name: /^Added to cart/ })).toBeVisible();
  const cart = await page.evaluate(() => JSON.parse(localStorage.getItem("ryan-store-cart")!));
  expect(cart.lines[0].merchandise.price).toEqual({ amount: "26.00", currencyCode: "USD" });
  expect(cart.lines[0].merchandise.compareAtPrice).toEqual({ amount: "32.00", currencyCode: "USD" });
});

test("loading and failed requests keep the original amounts and allow retry", async ({ page }) => {
  let release!: () => void;
  const pending = new Promise<void>((resolve) => { release = resolve; });
  let fail = true;
  await page.route("**/api/currency-rates", async (route) => {
    await pending;
    if (fail) {
      fail = false;
      return route.fulfill({ status: 503, json: { error: "Unavailable" } });
    }
    return route.fulfill({ json: rates });
  });
  await page.goto("/products/ryan-society-cap");
  const price = page.getByRole("main").locator('[aria-live="polite"] > p');
  const currency = price.getByRole("button");
  await currency.click();
  await option(page, "EUR").click();
  await expect(currency).toHaveAttribute("aria-busy", "true");
  await expect(price).toHaveAttribute("aria-busy", "true");
  await expect(price).toContainText("$26.00 USD, originally $32.00");
  release();
  await expect(page.getByText("Currency conversion is unavailable right now. Please try again.")).toBeVisible();
  await expect(currency).not.toHaveAttribute("aria-busy");
  await expect(price).toContainText("$26.00 USD, originally $32.00");
  expect(await page.evaluate((key) => localStorage.getItem(key), currencyStorageKey)).toBeNull();
  await currency.click();
  await option(page, "EUR").click();
  await expect(price).toContainText("≈€23.40 EUR, originally €28.80");
});

test("an unsupported saved currency is ignored without requesting rates", async ({ page }) => {
  await page.addInitScript((key) => localStorage.setItem(key, "INVALID"), currencyStorageKey);
  let requests = 0;
  await page.route("**/api/currency-rates", (route) => {
    requests += 1;
    return route.fulfill({ json: rates });
  });
  await page.goto("/products/ryan-society-cap");
  await expect(page.getByRole("main").locator('[aria-live="polite"] > p')).toHaveText("$26.00 USD, originally $32.00");
  await expect(page.getByRole("button", { name: "Prices in USD. Choose a currency" })).toBeEnabled();
  expect(requests).toBe(0);
});
