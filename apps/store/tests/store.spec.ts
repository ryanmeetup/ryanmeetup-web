import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { dad, superBlack } from "./fixtures/products";

test("cart links discover a new design through its Shopify tags", async ({ page }) => {
  await page.route("**/_next/image?**", (route) => route.fulfill({
    contentType: "image/png",
    body: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64"),
  }));
  const price = dad.variants[0].price;
  await page.addInitScript((cart) => localStorage.setItem("ryan-store-cart", JSON.stringify(cart)), {
    id: "demo-cart",
    checkoutUrl: "",
    totalQuantity: 1,
    cost: { subtotalAmount: price, totalAmount: price },
    lines: [{ id: "demo-dad-line", quantity: 1, merchandise: { ...dad.variants[0], product: { handle: dad.handle, title: dad.title, tags: dad.tags } } }],
  });
  await page.goto("/cart");
  const main = page.getByRole("main");
  await expect(main.getByText("Name Tag Shirt", { exact: true })).toHaveAttribute("href", "/products/name-tag-shirt?design=ryans-dad-name-tag-shirt&from=cart");
  await expect(main.getByText(dad.title, { exact: true })).toHaveCount(0);
  await expect(main).toContainText("Style: Ryan’s Dad");
});

test("cart lines move a listing member's title color into the options", async ({ page }) => {
  const variant = superBlack.variants[0];
  await page.addInitScript((cart) => localStorage.setItem("ryan-store-cart", JSON.stringify(cart)), {
    id: "demo-cart",
    checkoutUrl: "",
    totalQuantity: 1,
    cost: { subtotalAmount: variant.price, totalAmount: variant.price },
    lines: [{ id: "super-line", quantity: 1, merchandise: { ...variant, product: { handle: superBlack.handle, title: superBlack.title, tags: superBlack.tags } } }],
  });
  await page.goto("/cart");
  const main = page.getByRole("main");
  await expect(main.getByText("Super Ryan Shirt", { exact: true })).toBeVisible();
  await expect(main.getByText(superBlack.title, { exact: true })).toHaveCount(0);
  await expect(main.getByText(`Size: ${variant.selectedOptions[0].value} · Color: Black`, { exact: true })).toBeVisible();
});

test("returning from checkout empties the cart", async ({ page }) => {
  await seedCart(page);
  await page.goto("/thank-you");
  await expect.poll(() => page.evaluate(() => localStorage.getItem("ryan-store-cart"))).toBeNull();
  await expect(page.getByRole("button", { name: "Cart with 0 items" })).toBeVisible();
});

async function seedCart(page: Page) {
  const variant = superBlack.variants[0];
  await page.goto("/");
  await page.evaluate((cart) => localStorage.setItem("ryan-store-cart", JSON.stringify(cart)), {
    id: "demo-cart",
    checkoutUrl: "",
    totalQuantity: 2,
    cost: { subtotalAmount: variant.price, totalAmount: variant.price },
    lines: [{ id: "super-line", quantity: 2, merchandise: { ...variant, product: { handle: superBlack.handle, title: superBlack.title, tags: superBlack.tags } } }],
  });
}

test("emptying the cart asks first and can be cancelled", async ({ page }) => {
  await seedCart(page);
  await page.goto("/cart");
  const main = page.getByRole("main");
  await main.getByRole("button", { name: "Empty cart" }).click();
  const confirm = page.getByRole("dialog", { name: "Empty your cart?" });
  await expect(confirm).toContainText("This removes all 2 items from your cart.");
  await confirm.getByRole("button", { name: "Cancel" }).click();
  await expect(confirm).toHaveCount(0);
  await expect(main.getByText("Super Ryan Shirt", { exact: true })).toBeVisible();

  await main.getByRole("button", { name: "Empty cart" }).click();
  await confirm.getByRole("button", { name: "Empty cart" }).click();
  await expect(main.getByText("Your cart is remarkably Ryan-free.")).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem("ryan-store-cart"))).toBeNull();
});

test("the cart drawer can be emptied without closing it", async ({ page }) => {
  await seedCart(page);
  await page.goto("/collections/all");
  await page.getByRole("button", { name: "Cart with 2 items" }).click();
  const drawer = page.getByRole("dialog", { name: "Your cart" });
  await drawer.getByRole("button", { name: "Empty cart" }).click();
  await page.getByRole("dialog", { name: "Empty your cart?" }).getByRole("button", { name: "Empty cart" }).click();
  await expect(drawer.getByText("Your cart is remarkably Ryan-free.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Cart with 0 items" })).toBeAttached();
});

// Adding to the cart opens the drawer over the page; close it before going on.
async function keepShopping(page: Page) {
  await page.getByRole("button", { name: "Keep shopping" }).click();
  await expect(page.getByRole("button", { name: "Keep shopping" })).toHaveCount(0);
}

test("the header cart button opens the cart drawer instead of the cart page", async ({ page }) => {
  await page.goto("/collections/all");
  await page.getByRole("button", { name: /^Cart with \d+ items$/ }).click();
  await expect(page.getByRole("dialog", { name: "Your cart" }).getByText("Your cart is remarkably Ryan-free.")).toBeVisible();
  await expect(page).toHaveURL(/\/collections\/all$/);
});

test("name tag gallery shows every design and thumbnails choose the matching cart item", async ({ page }) => {
  await page.goto("/products/name-tag-shirt");
  const gallery = page.getByRole("group", { name: "Product photos" });
  await expect(gallery.getByRole("button")).toHaveCount(2);
  const ryanPhoto = gallery.getByRole("button", { name: "View Ryan image 1", exact: true });
  const momPhoto = gallery.getByRole("button", { name: "View Ryan’s Dad image 1", exact: true });
  await expect(ryanPhoto).toHaveAttribute("aria-pressed", "true");
  await momPhoto.click();
  await expect(page.getByLabel("Style")).toContainText("Ryan’s Dad");
  await expect(page.getByLabel("Color")).toContainText("Natural");
  await expect(momPhoto).toHaveAttribute("aria-pressed", "true");
  await expect(ryanPhoto).toHaveAttribute("aria-pressed", "false");
  await expect(gallery.getByRole("button")).toHaveCount(2);
  await page.getByRole("button", { name: "Add to cart", exact: true }).click();
  await expect(page.getByText("Added to cart", { exact: true })).toBeVisible();
  await keepShopping(page);
  const cart = await page.evaluate(() => JSON.parse(localStorage.getItem("ryan-store-cart")!));
  expect(cart.lines[0].merchandise.id).toBe("gid://shopify/ProductVariant/demo-ryans-dad-name-tag-shirt-0");
  await ryanPhoto.click();
  await expect(page.getByLabel("Style")).toContainText("Ryan");
  await expect(page.getByLabel("Color")).toContainText("White");
  await expect(ryanPhoto).toHaveAttribute("aria-pressed", "true");
});

test("name tag designs share one listing and add their own merchandise to the cart", async ({ page }) => {
  const renderingErrors: string[] = [];
  page.on("pageerror", (error) => renderingErrors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error" && message.text().includes("same key")) renderingErrors.push(message.text());
  });
  await page.goto("/collections/all");
  const listing = page.locator('main a[href="/products/name-tag-shirt?from=all"]');
  await expect(listing).toHaveCount(1);
  await expect(listing).toContainText("Name Tag Shirt");
  await expect(listing).toContainText("From $12.00");
  await expect(page.locator('main a[href^="/products/ryan-name-tag-shirt"], main a[href^="/products/ryans-mom-name-tag-shirt"]')).toHaveCount(0);
  await listing.click();
  await expect(page.getByRole("heading", { name: "Name Tag Shirt", exact: true })).toBeVisible();
  await expect(page.getByLabel("Style")).toHaveAttribute("aria-required", "true");
  await expect(page.getByLabel("Color")).toContainText("White");
  await expect(page.getByText("$12.00", { exact: true })).toBeVisible();
  const firstImage = await page.locator('main img').first().getAttribute("src");

  await page.getByRole("button", { name: "Add to cart" }).click();
  await expect(page.getByText("Added to cart", { exact: true })).toBeVisible();
  await keepShopping(page);
  await page.getByLabel("Style").click();
  await page.getByRole("option", { name: "Ryan’s Dad", exact: true }).click();
  // Switching styles keeps the breadcrumb's origin.
  await expect(page).toHaveURL(/\/products\/name-tag-shirt\?from=all&design=ryans-dad-name-tag-shirt$/);
  await expect(page.getByRole("heading", { name: "Name Tag Shirt", exact: true })).toHaveCount(1);
  await expect(page.getByLabel("Color")).toContainText("Natural");
  await expect(page.getByText("$30.00", { exact: true })).toBeVisible();
  await expect(page.locator('main img').first()).not.toHaveAttribute("src", firstImage!);
  await expect(page.getByRole("button", { name: "Add to cart" })).toBeVisible();
  await page.getByRole("button", { name: "Add to cart" }).click();
  await expect(page.getByText("Added to cart", { exact: true })).toBeVisible();
  await keepShopping(page);

  await page.goto("/cart");
  const cart = await page.evaluate(() => JSON.parse(localStorage.getItem("ryan-store-cart")!));
  expect(cart.lines.map((line: { merchandise: { id: string } }) => line.merchandise.id)).toEqual([
    "gid://shopify/ProductVariant/demo-ryan-name-tag-shirt-0",
    "gid://shopify/ProductVariant/demo-ryans-dad-name-tag-shirt-0",
  ]);
  const main = page.getByRole("main");
  await expect(main.locator('a[href="/products/name-tag-shirt?design=ryan"]', { hasText: "Name Tag Shirt" })).toHaveCount(1);
  await expect(main.locator('a[href="/products/name-tag-shirt?design=ryans-dad-name-tag-shirt"]', { hasText: "Name Tag Shirt" })).toHaveCount(1);
  await expect(main).toContainText("Style: Ryan’s Dad");
  await expect(page.getByText("$42.00", { exact: true })).toBeVisible();
  expect(renderingErrors).toEqual([]);
});

test("customer can quick add a size from the product grid in the previewed color", async ({ page }) => {
  await page.goto("/collections/all");
  await page.getByRole("button", { name: /^Preview .*Natural$/ }).first().click();
  await page.getByRole("button", { name: "Quick add Name Tag Shirt", exact: true }).click();
  const menu = page.getByRole("menu");
  await expect(menu).toContainText("Natural");
  await menu.getByRole("menuitem", { name: "S", exact: true }).click();

  // The dialog root has no box of its own, so assert on what it contains.
  const drawer = page.getByRole("dialog", { name: "Added to cart" });
  await expect(drawer.getByText("Just added")).toBeVisible();
  await expect(drawer.getByRole("link", { name: "View cart" })).toHaveCount(0);
  const cart = await page.evaluate(() => JSON.parse(localStorage.getItem("ryan-store-cart")!));
  expect(cart.lines.map((line: { merchandise: { id: string } }) => line.merchandise.id)).toEqual([
    "gid://shopify/ProductVariant/demo-ryans-dad-name-tag-shirt-0",
  ]);
});

test("name tag design URLs survive redirects, reloads, and browser history", async ({ page }) => {
  await page.goto("/products/ryans-dad-name-tag-shirt");
  await expect(page).toHaveURL(/\/products\/name-tag-shirt\?design=ryans-dad-name-tag-shirt$/);
  await expect(page.getByLabel("Style")).toContainText("Ryan’s Dad");
  await expect(page.getByLabel("Color")).toContainText("Natural");
  await page.getByLabel("Style").click();
  await page.getByRole("option", { name: "Ryan", exact: true }).click();
  await expect(page.getByLabel("Color")).toContainText("White");
  await page.reload();
  await expect(page.getByLabel("Style")).toContainText("Ryan");
  await expect(page.getByLabel("Color")).toContainText("White");
  await page.goBack();
  await expect(page.getByLabel("Style")).toContainText("Ryan’s Dad");
  await expect(page.getByLabel("Color")).toContainText("Natural");
  await page.goto("/products/ryan-name-tag-shirt");
  await expect(page).toHaveURL(/\/products\/name-tag-shirt\?design=ryan$/);
});

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
  await expect(page.getByText("We ship to most of the world.", { exact: false })).toBeVisible();
  await expect(page.getByText(/printful/i)).toHaveCount(0);
  await page.screenshot({ path: "/private/tmp/store-about-desktop.png", fullPage: true });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: "/private/tmp/store-about-mobile.png", fullPage: true });
  await page.getByRole("link", { name: "Shop the collection" }).click();
  await expect(page).toHaveURL(/\/collections\/all$/);
});

test("apparel and accessories are header links, and shop all sits in the collections menu", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/about");
  const mainNavigation = page.getByRole("navigation", { name: "Main navigation" });
  await expect(mainNavigation.getByRole("link", { name: "Shop all" })).toHaveCount(0);
  // The shared NavMenu opens on hover, as it does on ryanmeetup.com.
  await mainNavigation.getByRole("button", { name: "Collections" }).hover();
  await expect(page.getByRole("link", { name: "Shop all" })).toHaveAttribute("href", "/collections/all");
  await mainNavigation.getByRole("link", { name: "Apparel" }).click();
  await expect(page).toHaveURL(/\/collections\/apparel$/);
  await expect(mainNavigation.getByRole("link", { name: "Apparel" })).toHaveAttribute("aria-current", "page");

  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Open navigation" }).click();
  const mobileNavigation = page.getByRole("navigation", { name: "Mobile navigation" });
  const toggle = mobileNavigation.getByRole("button", { name: /^Collections/ });
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await expect(mobileNavigation.getByRole("link", { name: "Shop all" })).toBeHidden();
  await toggle.click();
  await mobileNavigation.getByRole("link", { name: "Shop all" }).click();
  await expect(page).toHaveURL(/\/collections\/all$/);
  await expect(mobileNavigation).toBeHidden();

  // On a page from the menu, the group opens already expanded.
  await page.getByRole("button", { name: "Open navigation" }).click();
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
});

test("product breadcrumbs name the page the customer came from", async ({ page }) => {
  const breadcrumb = page.getByRole("navigation", { name: "Breadcrumb" });
  await page.goto("/collections/apparel");
  await page.getByRole("main").getByRole("link", { name: /Ryan Meetup Tee/ }).first().click();
  await expect(page).toHaveURL(/\/products\/ryan-meetup-tee\?(.+&)?from=apparel/);
  await expect(breadcrumb.getByRole("listitem")).toHaveText([/^Store/, /^Apparel/, "Official Ryan Meetup Tee"]);
  await breadcrumb.getByRole("link", { name: "Apparel" }).click();
  await expect(page).toHaveURL(/\/collections\/apparel$/);

  await page.goto("/");
  await page.getByRole("main").getByRole("link", { name: /Ryan Meetup Tee/ }).first().click();
  await expect(page).toHaveURL(/\/products\/ryan-meetup-tee(\?|$)/);
  await expect(breadcrumb.getByRole("listitem")).toHaveText([/^Store/, "Official Ryan Meetup Tee"]);

  // A made-up origin is ignored rather than shown as a crumb.
  await page.goto("/products/ryan-meetup-tee?from=not-a-collection");
  await expect(breadcrumb.getByRole("listitem")).toHaveText([/^Store/, "Official Ryan Meetup Tee"]);
});

test("store navigation and breadcrumbs use icons", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/products/ryan-meetup-tee");
  await expect(
    page.getByRole("navigation", { name: "Main navigation" }).locator("a svg"),
  ).toHaveCount(4);
  await expect(
    page.getByRole("navigation", { name: "Breadcrumb" }).locator("li svg"),
  ).toHaveCount(2);
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
  ).toHaveCount(5); // four links and the collapsed Shop all chip
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
