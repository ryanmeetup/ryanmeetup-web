import { expect, test, type Page } from "@playwright/test";
import { demoProductId } from "../lib/demo-data";
import { configure, reset, signIn, state } from "./fixtures/buyer-browser";
import { customerPurchasePage } from "./fixtures/customer-purchase";
import { screenshotPath } from "./fixtures/screenshots";

// A signed-in synthetic buyer with one shipped purchase of the demo tee.
const productPath = "/products/ryan-meetup-tee#reviews";
const label = "Order #100 · Blue / M";

async function buyTee(request: Parameters<typeof reset>[0]) {
  const purchase = customerPurchasePage();
  purchase.order.customer.id = "gid://shopify/Customer/123";
  purchase.order.lineItems.nodes[0].productId = demoProductId("ryan-meetup-tee");
  await configure(request, { purchase });
}

/** Re-render the server components in place, the way a router refresh does, without remounting the page. */
async function refreshInPlace(page: Page) {
  await page.evaluate(() => (window as unknown as { next: { router: { refresh(): void } } }).next.router.refresh());
}

async function openComposer(page: Page) {
  await page.goto(productPath);
  const reviews = page.locator("#reviews");
  await reviews.getByRole("button", { name: "Write a review", exact: true }).click();
  return { reviews, dialog: page.getByRole("dialog", { name: "Write a review", exact: true }) };
}

test.beforeEach(async ({ request }) => { await reset(request, { empty: true }); await buyTee(request); });

for (const theme of ["light", "dark"]) {
  for (const width of [390, 1024, 1280, 1536]) {
    test(`a signed-in buyer writes and saves a review in ${theme} at ${width}px`, async ({ page, request, baseURL }) => {
      await signIn(page, baseURL!);
      await page.addInitScript((value) => localStorage.setItem("theme", value), theme);
      await page.setViewportSize({ width, height: 844 });
      const { reviews, dialog } = await openComposer(page);
      await expect(dialog).toContainText(`Reviewing ${label}`);
      await expect(dialog).toContainText("Shown publicly as Ryan F.");
      await expect(dialog.getByLabel("Email")).toHaveCount(0);
      await expect(dialog.getByLabel("Photos", { exact: true })).toHaveCount(0);

      await dialog.getByRole("button", { name: /^Show my name as/ }).click();
      await page.getByRole("option", { name: "Full name: Ryan Fixture", exact: true }).click();
      await expect(dialog).toContainText("Shown publicly as Ryan Fixture");

      await dialog.getByRole("radio", { name: "5 stars", exact: true }).check();
      await dialog.getByLabel(/^Title/).fill("  Fits like a Ryan ");
      await dialog.getByLabel(/^Review/).fill("Washed it twice and the name tag still pops.");
      // The dialog element itself has no box; measure and capture its visible form.
      await expect(dialog.getByRole("button", { name: "Submit review", exact: true })).toBeVisible();
      await page.screenshot({ path: screenshotPath(`store-custom-composer-${theme}-${width}.png`) });
      const bounds = await dialog.locator("form").boundingBox();
      expect(bounds!.x).toBeGreaterThanOrEqual(0);
      expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width);

      await dialog.getByRole("button", { name: "Submit review", exact: true }).click();
      await expect(dialog).toHaveCount(0);
      await expect(reviews.getByRole("status").filter({ hasText: "Review received" })).toContainText("Thanks! Your review is waiting for approval.");
      const { calls } = await state(request);
      expect(calls).toEqual([expect.objectContaining({
        operation: "review.submit", subject: "buyer-a", displayName: "Ryan Fixture",
        purchase: expect.objectContaining({ orderId: "100", lineId: "101", productId: demoProductId("ryan-meetup-tee").split("/").at(-1) }),
        submission: { rating: 5, title: "Fits like a Ryan", body: "Washed it twice and the name tag still pops.", nameStyle: "full" },
      })]);
    });
  }
}

test("a reviewed purchase can't be reviewed again", async ({ page, baseURL }) => {
  await signIn(page, baseURL!);
  const { reviews, dialog } = await openComposer(page);
  await dialog.getByRole("radio", { name: "5 stars", exact: true }).check();
  await dialog.getByLabel(/^Title/).fill("Super Ryan");
  await dialog.getByLabel(/^Review/).fill("This was a good shirt!");
  await dialog.getByRole("button", { name: "Submit review", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await page.reload();
  await reviews.getByRole("button", { name: "Write a review", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "You've already reviewed this", exact: true }).getByText("Edit or withdraw your review")).toBeVisible();
});

test("the buyer must pick a rating and give a title before submitting", async ({ page, baseURL }) => {
  await signIn(page, baseURL!);
  const { dialog } = await openComposer(page);
  await dialog.getByLabel(/^Review/).fill("No stars yet.");
  await dialog.getByRole("button", { name: "Submit review", exact: true }).click();
  await expect(dialog.getByText("Choose a rating before submitting your review.")).toBeVisible();
  await expect(dialog.getByLabel(/^Title/)).toHaveAttribute("required", "");
  await dialog.getByRole("radio", { name: "5 stars", exact: true }).check();
  await dialog.getByLabel(/^Title/).fill("   ");
  await dialog.getByRole("button", { name: "Submit review", exact: true }).click();
  await expect(dialog.getByText(/^Give your review a title/)).toBeVisible();
});

test("stars preview ratings without changing the saved selection", async ({ page, baseURL }) => {
  await signIn(page, baseURL!);
  const { dialog } = await openComposer(page);
  const rating = dialog.getByRole("radiogroup", { name: "Rating" });
  const four = rating.getByRole("radio", { name: "4 stars", exact: true });
  const five = rating.getByRole("radio", { name: "5 stars", exact: true });
  await four.check();
  await five.hover();
  await expect(rating.getByText("5 out of 5", { exact: true })).toBeVisible();
  await expect(four).toBeChecked();
  await dialog.getByLabel(/^Review/).hover();
  await expect(rating.getByText("Rated 4 out of 5", { exact: true })).toBeVisible();
});

test("keyboard arrows step by half stars with a full-star keyboard-only focus outline", async ({ page, baseURL }) => {
  await signIn(page, baseURL!);
  const { dialog } = await openComposer(page);
  const four = dialog.getByRole("radio", { name: "4 stars", exact: true });
  const fourHalf = dialog.getByRole("radio", { name: "4.5 stars", exact: true });
  await expect(dialog.getByRole("radio")).toHaveCount(10);
  await four.check();
  await expect(four.locator("../..")).toHaveCSS("outline-style", "none");
  await four.press("ArrowRight");
  await expect(fourHalf).toBeChecked();
  await expect(fourHalf).toBeFocused();
  await expect(fourHalf.locator("../..")).toHaveCSS("outline-width", "2px");
  await expect(fourHalf.locator("..")).toHaveCSS("box-shadow", "none");
  await expect(dialog.getByRole("radiogroup", { name: "Rating" })).toContainText("Rated 4.5 out of 5");
  await fourHalf.press("ArrowLeft");
  await expect(four).toBeChecked();
});

test("touch selects whole and half stars", async ({ browser, baseURL }) => {
  const context = await browser.newContext({ baseURL, hasTouch: true, viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  await signIn(page, baseURL!);
  const { dialog } = await openComposer(page);
  const four = dialog.getByRole("radio", { name: "4 stars", exact: true });
  await four.tap();
  await expect(four).toBeChecked();
  const half = dialog.getByRole("radio", { name: "4.5 stars", exact: true });
  await half.tap();
  await expect(half).toBeChecked();
  await expect(dialog.getByRole("radiogroup", { name: "Rating" })).toContainText("4.5 out of 5");
  await context.close();
});

test("a single purchase stays implied when access changes without a remount", async ({ page, request, baseURL }) => {
  await signIn(page, baseURL!);
  // Start with storage unavailable, so the composer mounts closed; recovering refreshes it in place.
  await configure(request, { failReviewedLines: true });
  await page.goto(productPath);
  const reviews = page.locator("#reviews");
  await expect(reviews).toContainText("Review collection is temporarily unavailable.");
  await configure(request, { failReviewedLines: false });
  await refreshInPlace(page);
  await expect(reviews.getByRole("button", { name: "Write a review", exact: true })).toBeEnabled();
  await reviews.getByRole("button", { name: "Write a review", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Write a review", exact: true });
  await dialog.getByRole("radio", { name: "5 stars", exact: true }).check();
  await dialog.getByLabel(/^Title/).fill("Super Ryan");
  await dialog.getByLabel(/^Review/).fill("This was a good shirt!");
  await dialog.getByRole("button", { name: "Submit review", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(reviews.getByRole("status").filter({ hasText: "Review received" })).toContainText("Thanks! Your review is waiting for approval.");
});

test("a signed-in buyer without a matching order writes an unverified review", async ({ page, request, baseURL }) => {
  await configure(request, { purchase: null });
  await signIn(page, baseURL!);
  const { reviews, dialog } = await openComposer(page);
  await expect(dialog).toContainText("We didn't find an order for this on your account, so your review shows without the Verified badge.");
  await expect(dialog.getByRole("button", { name: /^Purchase/ })).toHaveCount(0);
  await expect(dialog).toContainText("Shown publicly as Ryan F.");
  await dialog.getByRole("radio", { name: "4 stars", exact: true }).check();
  await dialog.getByLabel(/^Title/).fill("Got it as a gift");
  await dialog.getByLabel(/^Review/).fill("Didn't buy it myself, still wearing it every week.");
  await dialog.getByRole("button", { name: "Submit review", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(reviews.getByRole("status").filter({ hasText: "Review received" })).toContainText("Thanks! Your review is waiting for approval.");
  const { calls } = await state(request);
  expect(calls).toEqual([expect.objectContaining({
    operation: "review.submit", subject: "buyer-a", displayName: "Ryan F.",
    purchase: { orderId: null, lineId: null, productId: demoProductId("ryan-meetup-tee").split("/").at(-1), variantId: null, productTitle: "Official Ryan Meetup Tee", variantTitle: null },
  })]);
  // One unverified review per product.
  await page.reload();
  await reviews.getByRole("button", { name: "Write a review", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "You've already reviewed this", exact: true }).getByText("Edit or withdraw your review")).toBeVisible();
});

test("the header account menu signs a shopper in from any page and out again", async ({ page, request, baseURL }) => {
  // Signed out: the menu offers sign-in that comes back to this page.
  await page.goto("/apparel");
  await page.getByRole("button", { name: "Account", exact: true }).click();
  await page.getByRole("menuitem", { name: "Sign in" }).click();
  // Before leaving for Shopify, say what happens and that new shoppers are welcome.
  const explain = page.getByRole("dialog", { name: "Sign in with Shopify", exact: true });
  await expect(explain.getByText(/Already signed in to Shopify on this device/)).toBeVisible();
  await expect(explain.getByText(/New here\? Any email works/)).toBeVisible();
  await expect(explain.getByRole("link", { name: "Continue to Shopify", exact: true })).toHaveAttribute("href", "/api/reviews/auth/start?returnTo=%2Fapparel");
  await explain.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(explain).toHaveCount(0);

  await signIn(page, baseURL!);
  await page.goto(productPath);
  const account = page.getByRole("button", { name: "Account, signed in as your store account", exact: true });
  await account.click();
  await expect(page.getByRole("menuitem", { name: "My reviews" })).toHaveAttribute("href", "/reviews/mine");
  await expect(page.getByRole("menuitem", { name: "Sign in" })).toHaveCount(0);
  // The reviews section no longer repeats who is signed in.
  await expect(page.locator("#reviews").getByRole("button", { name: "Sign out" })).toHaveCount(0);

  // The real logout route checks the registered storefront origin, which this
  // localhost suite can't present (see customer-account-http.spec.ts). Answer
  // it the way the server does: end the session cookie and report success.
  let signOuts = 0;
  await page.route("**/api/reviews/auth/logout", async (route) => {
    expect(route.request().method()).toBe("POST");
    signOuts += 1;
    await page.context().clearCookies({ name: "__Host-store-customer-session" });
    await route.fulfill({ json: { signedOut: true } });
  });
  await page.getByRole("menuitem", { name: "Sign out" }).click();
  await expect(page.getByRole("button", { name: "Account", exact: true })).toBeVisible();
  await page.locator("#reviews").getByRole("button", { name: "Write a review", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Sign in to review", exact: true }).getByRole("link", { name: "Sign in", exact: true })).toBeVisible();
  expect(signOuts).toBe(1);
  expect((await state(request)).calls).toEqual([]);
});

test("after signing in, the shopper sees who they are and can switch to another account", async ({ page, baseURL }) => {
  await signIn(page, baseURL!);
  // What the sign-in callback leaves behind for the page it returns to.
  await page.context().addCookies([{ name: "store-signed-in-notice", value: "1", url: baseURL! }]);
  await page.goto("/apparel");
  const notice = page.getByText(/^Signed in as/).filter({ hasText: "your store account" });
  await expect(notice).toBeVisible();
  // Shown once: the notice cookie is gone after this load.
  expect((await page.context().cookies()).some((cookie) => cookie.name === "store-signed-in-notice")).toBe(false);

  // Switching ends this session, visits Shopify's logout (stood in for by a store page here),
  // then starts a fresh sign-in on its own so Shopify asks for an email instead of reusing one.
  await page.route("**/api/reviews/auth/switch", async (route) => {
    await page.context().clearCookies({ name: "__Host-store-customer-session" });
    await route.fulfill({ json: { signedOut: true, shopifyLogoutUrl: new URL("/collections", baseURL).href } });
  });
  await page.route("**/api/reviews/auth/start**", (route) => route.fulfill({ contentType: "text/html", body: "<title>Shopify sign-in</title>" }));
  await page.getByRole("button", { name: "Not you? Use a different account", exact: true }).click();
  await page.waitForURL(/\/api\/reviews\/auth\/start\?returnTo=%2Fcollections$/);
});

test("a signed-out visitor is asked to sign in", async ({ page }) => {
  await page.goto(productPath);
  const reviews = page.locator("#reviews");
  await reviews.getByRole("button", { name: "Write a review", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Sign in to review", exact: true });
  await expect(dialog.getByRole("link", { name: "Sign in", exact: true })).toHaveAttribute("href", /\/api\/reviews\/auth\/start\?returnTo=/);
});
