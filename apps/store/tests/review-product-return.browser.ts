import { expect, test } from "@playwright/test";
import { summarizeReviewRatings } from "@ryanmeetup/reviews";
import { tee } from "./fixtures/products";

const fixture = `http://127.0.0.1:${process.env.PRODUCT_REVIEW_FIXTURE_PORT ?? 54369}`;
const retired = "Classic Ryan pin & sticker set";
const review = (productId: string, productTitle: string, n: number) => ({
  id: `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`, rating: 5,
  title: "Still a favorite", body: "I would buy this again.", displayName: `Ryan ${n}`,
  publishedAt: `2026-11-20T12:00:0${n}.000Z`, editedAt: null,
  item: { productId, productTitle, variantTitle: null }, verifiedPurchase: true,
  source: "store", photos: [], reply: null,
});

test.beforeEach(async ({ request }) => {
  const activeId = tee.id.split("/").at(-1)!;
  await request.post(`${fixture}/__configure`, { data: Object.fromEntries([
    ["999999999", retired, 1], [activeId, tee.title, 2],
  ].map(([id, title, n]) => [id, {
    summary: summarizeReviewRatings([5]), reviews: [review(String(id), String(title), Number(n))],
  }])) });
});

test("removed-item reviews lead to a prefilled request and support delivery can retry", async ({ page }) => {
  for (const path of ["/", "/reviews"]) {
    await page.goto(path);
    const active = page.getByRole("article", { name: "Review by Ryan 2", exact: true });
    await expect(active.getByRole("link", { name: `Review of ${tee.title}`, exact: true })).toBeVisible();
    await expect(active.getByText("Request its return")).toHaveCount(0);
    await expect(active.getByRole("button", { name: /^Availability of / })).toHaveCount(0);
    const removed = page.getByRole("article", { name: "Review by Ryan 1", exact: true });
    await expect(removed).toContainText(retired);
    const trigger = removed.getByRole("button", { name: `Availability of ${retired}`, exact: true });
    const popover = page.getByRole("dialog", { name: `Availability of ${retired}`, exact: true });
    await expect(popover).toHaveCount(0);
    await trigger.click();
    await expect(popover.getByText("This item is no longer in the store.")).toBeVisible();
    await expect(popover.getByRole("link", { name: `Request its return: ${retired}`, exact: true })).toBeVisible();
    await trigger.press("Escape");
    await expect(popover).toHaveCount(0);
    await expect(trigger).toBeFocused();
    await trigger.press("Enter");
    await expect(popover).toBeVisible();
  }
  await page.getByRole("link", { name: `Request its return: ${retired}`, exact: true }).click();
  await expect(page.getByRole("heading", { name: "Want to see it back?" })).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Item you’d like back" })).toHaveValue(retired);
  await expect(page.getByRole("textbox", { name: "Item you’d like back" })).toHaveAttribute("required", "");
  await expect(page.getByRole("textbox", { name: "Order number" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Preferred resolution/ })).toHaveCount(0);
  await page.getByRole("textbox", { name: "First name" }).fill("Ryan");
  await page.getByRole("textbox", { name: "Last name" }).fill("Tester");
  await page.getByRole("textbox", { name: "Contact email" }).fill("ryan@example.com");
  // Additional details are deliberately left blank: the item identifies the request.
  const deliveries: Record<string, string>[] = [];
  await page.route("https://api.emailjs.com/api/v1.0/email/send", async (route) => {
    deliveries.push(route.request().postDataJSON().template_params);
    await route.fulfill({ status: deliveries.length === 1 ? 503 : 200, body: deliveries.length === 1 ? "Please try again" : "OK" });
  });
  await page.getByRole("button", { name: "Send return request", exact: true }).click();
  await expect(page.locator("form").getByRole("alert")).toContainText("Please try again");
  await expect(page.getByRole("textbox", { name: "Item you’d like back" })).toHaveValue(retired);
  await page.getByRole("button", { name: "Send return request", exact: true }).click();
  await expect(page.getByText("Request sent. Thanks for letting us know what you’d like back!")).toBeVisible();
  expect(deliveries).toHaveLength(2);
  expect(deliveries[1]).toMatchObject({
    routeTo: "ryan@ryanmeetup.com", topicValue: "product-return", source: "store-product-return",
    email: "ryan@example.com", subject: `[Store: Bring back an item] ${retired}`,
  });
  expect(deliveries[1].message).toContain(`Requested item: ${retired}`);
  expect(deliveries[1].message).not.toContain("Order number:");
});

for (const theme of ["light", "dark"]) for (const width of [390, 1024, 1280, 1536]) {
  test(`return request fits ${theme} at ${width}px`, async ({ page }, testInfo) => {
    await page.addInitScript((value) => localStorage.setItem("theme", value), theme);
    await page.setViewportSize({ width, height: 1000 });
    await page.goto("/reviews");
    const card = page.getByRole("article", { name: "Review by Ryan 1", exact: true });
    await card.scrollIntoViewIfNeeded();
    // Production forces dark mode; explicitly exercise both sets of shared CSS.
    await page.evaluate((value) => document.documentElement.classList.toggle("dark", value === "dark"), theme);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await card.screenshot({ path: testInfo.outputPath(`return-card-${theme}-${width}.png`) });
    const trigger = card.getByRole("button", { name: `Availability of ${retired}`, exact: true });
    await trigger.focus(); await trigger.press("Enter");
    const popover = page.getByRole("dialog", { name: `Availability of ${retired}`, exact: true });
    await expect(popover).toBeVisible();
    const bounds = await popover.boundingBox();
    expect(bounds).not.toBeNull();
    expect(bounds!.x).toBeGreaterThanOrEqual(0);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width);
    await popover.screenshot({ path: testInfo.outputPath(`return-popover-${theme}-${width}.png`) });
    const link = popover.getByRole("link", { name: `Request its return: ${retired}`, exact: true });
    await link.focus(); await expect(link).toBeFocused(); await link.press("Enter");
    await expect(page.getByRole("textbox", { name: "Item you’d like back" })).toHaveValue(retired);
    await page.evaluate((value) => document.documentElement.classList.toggle("dark", value === "dark"), theme);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.locator("main").screenshot({ path: testInfo.outputPath(`return-form-${theme}-${width}.png`) });
  });
}
