import { expect, test } from "@playwright/test";

test("customer can browse a product and manage the preview cart", async ({
  page,
}) => {
  await page.goto("/products/ryan-meetup-tee");
  await expect(
    page.getByRole("heading", { name: "Official Ryan Meetup Tee" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Add to cart" }).click();
  await expect(page.getByText("Added to cart", { exact: true })).toBeVisible();

  await page.goto("/cart");
  await expect(page.getByRole("heading", { name: "Your cart" })).toBeVisible();
  await expect(
    page.getByText("Official Ryan Meetup Tee", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Increase Official Ryan Meetup Tee quantity" })
    .click();
  await expect(page.getByLabel("Quantity 2")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Connect Shopify to checkout" }),
  ).toBeDisabled();
});

test("customer can switch between the Ryan Meetup light and dark themes", async ({
  page,
}) => {
  const themeErrors: string[] = [];
  page.on("console", (message) => {
    if (
      message.type() === "error" &&
      (message
        .text()
        .includes("Encountered a script tag while rendering React component") ||
        message
          .text()
          .includes(
            "Hydration failed because the server rendered HTML didn't match the client",
          ))
    ) {
      themeErrors.push(message.text());
    }
  });

  await page.goto("/");
  await expect(page.locator("html")).toHaveClass(/dark/);
  await page.getByRole("button", { name: "Change to Light Mode" }).click();
  await expect(page.locator("html")).toHaveClass(/light/);
  await expect(
    page.getByRole("button", { name: "Change to Dark Mode" }),
  ).toBeVisible();
  await page.reload();
  await expect(page.locator("html")).toHaveClass(/light/);
  expect(themeErrors).toEqual([]);
  await page.screenshot({
    path: "/private/tmp/store-light.png",
    fullPage: true,
  });
});

test("customer can browse the merch hero gallery", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("The Ryan merch table")).toBeVisible();
  await page.getByRole("button", { name: "Show next photo" }).click();
  await expect(page.getByText("Ryan’s Game Show")).toBeVisible();
});

test("customer can open store support and enter order details", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/contact");
  await expect(
    page.getByRole("heading", { name: "Let’s sort out your order." }),
  ).toBeVisible();
  await expect(page.getByLabel("First name")).toHaveAttribute("required", "");
  await expect(page.getByLabel("Order number")).not.toHaveAttribute(
    "required",
    "",
  );
  await expect(page.getByLabel("Product name")).toHaveCount(0);
  await expect(
    page.getByText("Required fields are marked *", { exact: true }),
  ).toHaveCount(0);
  await page.getByLabel("First name").fill("Ryan");
  await page.getByLabel("Order number").fill("RM-1234");
  await expect(
    page.getByRole("button", { name: "Send to customer service" }),
  ).toBeVisible();
  await page.screenshot({
    path: "/private/tmp/store-contact-dark.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: "/private/tmp/store-contact-mobile.png",
    fullPage: true,
  });
});

test("customer can read about the store and get back to shopping", async ({ page }) => {
  await page.goto("/");
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.getByRole("navigation", { name: "Main navigation" }).getByRole("link", { name: "About" }).click();
  await expect(page).toHaveURL(/\/about$/);
  await expect(page.getByRole("main").getByRole("heading", { level: 1 })).toHaveText("Official provisions for the Ryan people.");
  await expect(page.getByText("We can’t accept returns.", { exact: false })).toBeVisible();
  await expect(page.getByRole("link", { name: "shipping guidelines" })).toHaveAttribute("href", "https://www.printful.com/shipping");
  await page.screenshot({ path: "/private/tmp/store-about-desktop.png", fullPage: true });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: "/private/tmp/store-about-mobile.png", fullPage: true });
  await page.getByRole("link", { name: "Shop the collection" }).click();
  await expect(page).toHaveURL(/\/collections\/all$/);
});

test("store navigation and breadcrumbs use icons", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/products/ryan-meetup-tee");
  await expect(
    page.getByRole("navigation", { name: "Main navigation" }).locator("a svg"),
  ).toHaveCount(5);
  await expect(
    page.getByRole("navigation", { name: "Breadcrumb" }).locator("li svg"),
  ).toHaveCount(3);
  await page.screenshot({
    path: "/private/tmp/store-product-breadcrumbs.png",
    fullPage: false,
  });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Open navigation" }).click();
  await expect(
    page
      .getByRole("navigation", { name: "Mobile navigation" })
      .locator("a svg"),
  ).toHaveCount(5);
  await page.screenshot({
    path: "/private/tmp/store-mobile-navigation.png",
    fullPage: false,
  });
});

for (const viewport of [
  { name: "mobile", width: 390, height: 844 },
  { name: "tablet", width: 1024, height: 900 },
  { name: "desktop", width: 1280, height: 900 },
  { name: "wide", width: 1536, height: 960 },
]) {
  test(`home layout at ${viewport.name}`, async ({ page }) => {
    await page.setViewportSize({
      width: viewport.width,
      height: viewport.height,
    });
    await page.goto("/");
    await expect(
      page.getByRole("heading", {
        name: "Dress like everyone knows your name.",
      }),
    ).toBeVisible();
    if (viewport.name === "mobile") {
      await expect(
        page.getByRole("button", { name: "Open navigation" }),
      ).toBeVisible();
    }
    await page.screenshot({
      path: `/private/tmp/store-${viewport.name}.png`,
      fullPage: true,
    });
  });
}
