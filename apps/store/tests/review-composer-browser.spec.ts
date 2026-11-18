import { expect, test, type Page } from "@playwright/test";
import { demoProductId } from "../lib/demo-data";
import { configure, reset, signIn, state } from "./fixtures/buyer-browser";
import { customerPurchasePage } from "./fixtures/customer-purchase";

// A signed-in synthetic buyer with one shipped purchase of the demo tee.
const productPath = "/products/ryan-meetup-tee#reviews";
const label = "Order #100 · Blue / M";

async function buyTee(request: Parameters<typeof reset>[0]) {
  const purchase = customerPurchasePage();
  purchase.order.customer.id = "gid://shopify/Customer/123";
  purchase.order.lineItems.nodes[0].productId = demoProductId("ryan-meetup-tee");
  await configure(request, { purchase });
}

async function choose(page: Page, name: string) {
  const option = page.getByRole("option", { name, exact: true });
  // The page can re-render after a switch and close the menu mid-click; retry opening and choosing together.
  await expect(async () => {
    if (!(await option.isVisible())) await page.getByRole("button", { name: /^Review mode/ }).click();
    await option.click({ timeout: 2000 });
  }).toPass({ timeout: 60_000 });
  await expect(page.getByRole("complementary", { name: "Review testing" })).toHaveAttribute("aria-busy", "false");
}

async function openComposer(page: Page) {
  await page.goto(productPath);
  const reviews = page.locator("#reviews");
  await expect(reviews).toContainText("Signed in as your store account");
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

      await dialog.getByRole("button", { name: /^Show my name as/ }).click();
      await page.getByRole("option", { name: "Full name: Ryan Fixture", exact: true }).click();
      await expect(dialog).toContainText("Shown publicly as Ryan Fixture");

      await dialog.getByRole("radio", { name: "5 stars", exact: true }).check();
      await dialog.getByLabel(/^Title/).fill("  Fits like a Ryan ");
      await dialog.getByLabel(/^Review/).fill("Washed it twice and the name tag still pops.");
      // The dialog element itself has no box; measure and capture its visible form.
      await expect(dialog.getByRole("button", { name: "Submit review", exact: true })).toBeVisible();
      await page.screenshot({ path: `/private/tmp/store-custom-composer-${theme}-${width}.png` });
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

test("a single purchase stays implied when access changes without a remount", async ({ page, request, baseURL }) => {
  await signIn(page, baseURL!);
  // Start with storage unavailable, so the composer mounts closed; recovering refreshes it in place.
  await configure(request, { failReviewedLines: true });
  await page.goto(productPath);
  const reviews = page.locator("#reviews");
  await expect(reviews).toContainText("Review collection is temporarily unavailable.");
  await configure(request, { failReviewedLines: false });
  await choose(page, "Environment default");
  await expect(reviews).toContainText("Signed in as your store account");
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

test("a signed-in buyer can see who they are and sign out", async ({ page, request, baseURL }) => {
  await signIn(page, baseURL!);
  await page.goto(productPath);
  const reviews = page.locator("#reviews");
  await expect(reviews).toContainText("Signed in as your store account");
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
  await reviews.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(reviews).not.toContainText("Signed in as");
  await reviews.getByRole("button", { name: "Write a review", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Sign in to review", exact: true }).getByRole("link", { name: "Sign in", exact: true })).toBeVisible();
  expect(signOuts).toBe(1);
  expect((await state(request)).calls).toEqual([]);
});

test("a signed-out visitor is asked to sign in", async ({ page }) => {
  await page.goto(productPath);
  const reviews = page.locator("#reviews");
  await reviews.getByRole("button", { name: "Write a review", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Sign in to review", exact: true });
  await expect(dialog.getByRole("link", { name: "Sign in", exact: true })).toHaveAttribute("href", /\/api\/reviews\/auth\/start\?returnTo=/);
});
