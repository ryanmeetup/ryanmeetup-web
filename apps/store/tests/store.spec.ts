import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { dad, superBlack } from "./fixtures/products";
import { screenshotPath } from "./fixtures/screenshots";

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
  await expect(main.getByText(`Size: ${variant.selectedOptions[0].value}`, { exact: true })).toBeVisible();
  await expect(main.getByText("Color: Black", { exact: true })).toBeVisible();
});

test("returning from checkout empties the cart", async ({ page }) => {
  // Demo carts live only in the browser, so there is no Shopify cart to sync against.
  const { demo } = await (await page.request.post("/api/cart", { data: {} })).json();
  test.skip(demo === true, "Requires a store server connected to Shopify.");
  // Shopify returns no cart once it has checked out, whichever store page the shopper lands on.
  await page.route("**/api/cart", (route) => route.fulfill({ json: { cart: null } }));
  const variant = superBlack.variants[0];
  await page.addInitScript((cart) => localStorage.setItem("ryan-store-cart", JSON.stringify(cart)), {
    id: "gid://shopify/Cart/checked-out",
    checkoutUrl: "https://checkout.ryanmeetup.com/cart/c/checked-out",
    totalQuantity: 2,
    cost: { subtotalAmount: variant.price, totalAmount: variant.price },
    lines: [{ id: "super-line", quantity: 2, merchandise: { ...variant, product: { handle: superBlack.handle, title: superBlack.title, tags: superBlack.tags } } }],
  });
  await page.goto("/");
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
  // Opening focus stays on close rather than the destructive trash button beside it.
  await expect(drawer.getByRole("button", { name: "Close panel" })).toBeFocused();
  const trash = drawer.getByRole("button", { name: "Empty cart" });
  await trash.hover();
  await expect(page.getByRole("tooltip", { name: "Empty cart" })).toBeVisible();
  await trash.click();
  await page.getByRole("dialog", { name: "Empty your cart?" }).getByRole("button", { name: "Empty cart" }).click();
  await expect(drawer.getByText("Your cart is remarkably Ryan-free.")).toBeVisible();
  await expect(trash).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Cart with 0 items" })).toBeAttached();

  await drawer.getByRole("link", { name: /Apparel/ }).click();
  await expect(page).toHaveURL(/\/apparel$/);
  await expect(drawer).toHaveCount(0);
});

test("a markdown shows on the card, the product page, and the cart line", async ({ page }) => {
  // This checks the product markdown outside the separately tested seasonal sale.
  await page.clock.setFixedTime(new Date("2026-11-01T12:00:00Z"));
  await page.goto("/accessories");
  const card = page.getByRole("link", { name: /Ryan Society Cap/ });
  await expect(card).toContainText("Sale");
  await expect(card.locator("..").locator("p.bg-price")).toContainText("$26.00 USD, originally $32.00");

  await card.click();
  const main = page.getByRole("main");
  const price = main.locator('[aria-live="polite"] > p');
  await expect(price).toContainText("$26.00 USD, originally $32.00");
  await expect(price.locator("s")).toHaveText(", originally $32.00");
  await expect(main.getByText("Sale", { exact: true })).toBeVisible();

  await main.getByRole("button", { name: "Add to cart" }).click();
  const drawer = page.getByRole("dialog", { name: /^Added to cart/ });
  await expect(drawer.getByText("Originally $32.00")).toBeVisible();
  await expect(drawer.getByText("Sale", { exact: true })).toBeVisible();
});

test("collection pages sort by price and newest, and the sort survives a reload", async ({ page }) => {
  await page.goto("/collections/all");
  const titles = page.getByRole("main").getByRole("heading", { level: 3 });
  await page.getByRole("button", { name: "Filters", exact: true }).click();
  await page.getByRole("button", { name: /^Sort/ }).click();
  await page.getByRole("option", { name: "Price: high to low" }).click();
  await expect(page).toHaveURL(/\?sort=price-high$/);
  const byPrice = ["Hello, My Name Is Ryan Sweatshirt", "RY-D Membership Card (opens in a new tab)", "Official Ryan Meetup Tee", "Ryan Society Cap", "Certified Ryan Pack", "Name Tag Shirt"];
  await expect(titles).toHaveText(byPrice);
  await page.reload();
  await expect(titles).toHaveText(byPrice);
});

for (const width of [393, 1280]) {
  test(`catalog filters start collapsed and retain sorting at ${width}px`, async ({ page }) => {
    const renderingErrors: string[] = [];
    page.on("pageerror", (error) => renderingErrors.push(error.message));
    page.on("console", (message) => {
      if (message.type() === "error" && /hydration|hydrated|server rendered/i.test(message.text())) {
        renderingErrors.push(message.text());
      }
    });
    await page.setViewportSize({ width, height: 900 });
    for (const path of ["/apparel", "/accessories", "/collections/all", "/apparel/t-shirts"]) {
      await page.goto(path);
      const toggle = page.getByRole("button", { name: "Filters", exact: true });
      const sort = page.getByRole("button", { name: /^Sort / });
      await expect(toggle).toHaveAttribute("aria-expanded", "false");
      await expect(toggle).toHaveAccessibleDescription(/^\d+ items$/);
      const summary = await toggle.getAttribute("aria-describedby");
      expect(summary).toBeTruthy();
      await expect(sort).toHaveCount(0);

      await toggle.click();
      await expect(toggle).toHaveAttribute("aria-expanded", "true");
      await sort.click();
      await page.getByRole("option", { name: "Newest", exact: true }).click();
      await expect(page).toHaveURL(`${path}?sort=newest`);

      await toggle.focus();
      await toggle.press("Enter");
      await expect(toggle).toHaveAttribute("aria-expanded", "false");
      await expect(sort).toHaveCount(0);
      await toggle.click();
      await expect(sort).toContainText("Newest");

      await page.reload();
      await expect(toggle).toHaveAttribute("aria-expanded", "false");
      await toggle.click();
      await expect(sort).toContainText("Newest");
      await expect(toggle).toHaveAccessibleDescription(/^\d+ items$/);
      expect(renderingErrors, `Rendering errors on ${path} at ${width}px`).toEqual([]);
    }
  });
}

test("apparel groups listings by garment, t-shirts first, and sorts within each grouping", async ({ page }) => {
  await page.goto("/apparel");
  const main = page.getByRole("main");
  const titles = main.getByRole("heading", { level: 3 });
  await expect(main.getByRole("button", { name: "T-Shirts" })).toBeVisible();
  await expect(main.getByRole("button", { name: "Hoodies & Sweatshirts" })).toBeVisible();
  // A grouping's own page is in the header menu, so its section has no button.
  await expect(main.getByRole("link", { name: "View Collection" })).toHaveCount(0);
  await expect(main.getByRole("link", { name: /^Shop all/i })).toHaveCount(0);
  await expect(titles).toHaveText(["Official Ryan Meetup Tee", "Name Tag Shirt", "Hello, My Name Is Ryan Sweatshirt"]);

  // A grouped listing is as new as its newest design.
  await page.goto("/apparel?sort=newest");
  await expect(titles).toHaveText(["Name Tag Shirt", "Official Ryan Meetup Tee", "Hello, My Name Is Ryan Sweatshirt"]);
});

test("retired garment collections and the old department URLs redirect to the top level", async ({ page }) => {
  await page.goto("/collections/hoodies");
  await expect(page).toHaveURL(/\/apparel\/hoodies$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Hoodies & Sweatshirts");
  await page.goto("/collections/accessories/pins");
  await expect(page).toHaveURL(/\/accessories\/pins$/);
  await page.goto("/collections/apparel");
  await expect(page).toHaveURL(/\/apparel$/);
});

test("a garment page lists only its garment under a department breadcrumb", async ({ page }) => {
  await page.goto("/apparel/t-shirts");
  const main = page.getByRole("main");
  await expect(page.getByRole("navigation", { name: "Breadcrumb" }).getByRole("listitem")).toHaveText([/^Store/, /^Apparel/, /^T-Shirts/]);
  await expect(main.getByRole("heading", { level: 3 })).toHaveText(["Official Ryan Meetup Tee", "Name Tag Shirt"]);
  // Click the title: a sale's taller price badge can cover the link's center.
  await main.getByRole("link", { name: /Ryan Meetup Tee/ }).first().getByRole("heading").click();
  await expect(page.getByRole("navigation", { name: "Breadcrumb" }).getByRole("listitem")).toHaveText([/^Store/, /^Apparel/, /^T-Shirts/, "Official Ryan Meetup Tee"]);
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

test("name tag gallery shows only the chosen style and its photos keep that style's cart item", async ({ page }) => {
  await page.goto("/products/name-tag-shirt");
  const gallery = page.getByRole("group", { name: "Product photos" });
  await expect(gallery.getByRole("button")).toHaveCount(2);
  const ryanPhoto = gallery.getByRole("button", { name: "View Ryan image 1", exact: true });
  await expect(ryanPhoto).toHaveAttribute("aria-pressed", "true");
  await expect(gallery.getByRole("button", { name: /Ryan’s Dad/ })).toHaveCount(0);
  await page.getByLabel("Style").click();
  await page.getByRole("option", { name: "Ryan’s Dad", exact: true }).click();
  const dadFront = gallery.getByRole("button", { name: "View Ryan’s Dad image 1", exact: true });
  const dadBack = gallery.getByRole("button", { name: "View Ryan’s Dad image 2", exact: true });
  await expect(dadFront).toHaveAttribute("aria-pressed", "true");
  await expect(gallery.getByRole("button", { name: /^View Ryan image/ })).toHaveCount(0);
  await dadBack.click();
  await expect(page.getByLabel("Style")).toContainText("Ryan’s Dad");
  await expect(page.getByLabel("Color")).toContainText("Natural");
  await expect(dadBack).toHaveAttribute("aria-pressed", "true");
  await expect(dadFront).toHaveAttribute("aria-pressed", "false");
  await page.getByLabel("Size").click();
  await page.getByRole("option", { name: "S", exact: true }).click();
  await page.getByRole("button", { name: "Add to cart", exact: true }).click();
  await expect(page.getByRole("heading", { name: /^Added to cart/ })).toBeVisible();
  await keepShopping(page);
  const cart = await page.evaluate(() => JSON.parse(localStorage.getItem("ryan-store-cart")!));
  expect(cart.lines[0].merchandise.id).toBe("gid://shopify/ProductVariant/demo-ryans-dad-name-tag-shirt-0");
  await page.getByLabel("Style").click();
  await page.getByRole("option", { name: "Ryan", exact: true }).click();
  await expect(page.getByLabel("Color")).toContainText("White");
  await expect(ryanPhoto).toHaveAttribute("aria-pressed", "true");
});

test("a product page offers other listings without repeating its own designs", async ({ page }) => {
  await page.goto("/products/name-tag-shirt");
  const related = page.getByRole("region", { name: "More from this shop" });
  await expect(related.locator('a[href="/products/ryan-meetup-tee"]').first()).toBeVisible();
  await expect(related.locator('a[href^="/products/name-tag-shirt"], a[href^="/products/ryan-name-tag-shirt"], a[href^="/products/ryans-dad-name-tag-shirt"]')).toHaveCount(0);
  await expect(related.getByRole("link", { name: "Browse all apparel" })).toHaveAttribute("href", "/apparel");
});

test("name tag designs share one listing and add their own merchandise to the cart", async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-11-01T12:00:00Z"));
  const renderingErrors: string[] = [];
  page.on("pageerror", (error) => renderingErrors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error" && message.text().includes("same key")) renderingErrors.push(message.text());
  });
  await page.goto("/collections/all");
  const listing = page.locator('main a[href="/products/name-tag-shirt?from=all"]');
  await expect(listing).toHaveCount(1);
  await expect(listing).toContainText("Name Tag Shirt");
  await expect(listing.locator("..").locator("p.bg-price")).toContainText("From $12.00");
  await expect(page.locator('main a[href^="/products/ryan-name-tag-shirt"], main a[href^="/products/ryans-mom-name-tag-shirt"]')).toHaveCount(0);
  await listing.click();
  await expect(page.getByRole("heading", { name: "Name Tag Shirt", exact: true })).toBeVisible();
  await expect(page.getByLabel("Style")).toHaveAttribute("aria-required", "true");
  await expect(page.getByLabel("Color")).toContainText("White");
  await expect(page.getByText("$12.00", { exact: true })).toBeVisible();
  const firstImage = await page.locator('main img').first().getAttribute("src");

  await page.getByLabel("Size").click();
  await page.getByRole("option", { name: "S", exact: true }).click();
  await page.getByRole("button", { name: "Add to cart" }).click();
  await expect(page.getByRole("heading", { name: /^Added to cart/ })).toBeVisible();
  await keepShopping(page);
  await page.getByLabel("Style").click();
  await page.getByRole("option", { name: "Ryan’s Dad", exact: true }).click();
  // Switching styles keeps the breadcrumb's origin.
  await expect(page).toHaveURL(/\/products\/name-tag-shirt\?from=all&design=ryans-dad-name-tag-shirt$/);
  await expect(page.getByRole("heading", { name: "Name Tag Shirt", exact: true })).toHaveCount(1);
  await expect(page.getByLabel("Color")).toContainText("Natural");
  await expect(page.getByText("$30.00", { exact: true })).toBeVisible();
  await expect(page.locator('main img').first()).not.toHaveAttribute("src", firstImage!);
  await expect(page.getByRole("button", { name: "Choose a size", exact: true })).toBeDisabled();
  await page.getByLabel("Size").click();
  await page.getByRole("option", { name: "S", exact: true }).click();
  await page.getByRole("button", { name: "Add to cart" }).click();
  await expect(page.getByRole("heading", { name: /^Added to cart/ })).toBeVisible();
  await keepShopping(page);

  await page.goto("/cart");
  const cart = await page.evaluate(() => JSON.parse(localStorage.getItem("ryan-store-cart")!));
  expect(cart.lines.map((line: { merchandise: { id: string } }) => line.merchandise.id)).toEqual([
    "gid://shopify/ProductVariant/demo-ryan-name-tag-shirt-0",
    "gid://shopify/ProductVariant/demo-ryans-dad-name-tag-shirt-0",
  ]);
  const main = page.getByRole("main");
  await expect(main.locator('a[href="/products/name-tag-shirt?design=ryan&from=cart"]', { hasText: "Name Tag Shirt" })).toHaveCount(1);
  await expect(main.locator('a[href="/products/name-tag-shirt?design=ryans-dad-name-tag-shirt&from=cart"]', { hasText: "Name Tag Shirt" })).toHaveCount(1);
  await expect(main).toContainText("Style: Ryan’s Dad");
  await expect(page.getByText("$42.00", { exact: true })).toBeVisible();
  expect(renderingErrors).toEqual([]);
});

test("customer can quick add a size from the product grid in the previewed color", async ({ page }) => {
  await page.goto("/collections/all");
  await page.getByRole("button", { name: /^Preview .*Natural$/ }).first().click();
  await page.getByRole("button", { name: "Quick add Name Tag Shirt", exact: true }).click();
  const panel = page.getByRole("dialog", { name: "Quick add Name Tag Shirt" });
  await expect(panel).toContainText("Natural");
  await panel.getByRole("button", { name: "S", exact: true }).click();

  // The dialog root has no box of its own, so assert on what it contains.
  const drawer = page.getByRole("dialog", { name: "Added to cart" });
  await expect(drawer.getByText("Just added")).toBeVisible();
  await expect(drawer.getByRole("link", { name: "View cart" })).toHaveCount(0);
  const cart = await page.evaluate(() => JSON.parse(localStorage.getItem("ryan-store-cart")!));
  expect(cart.lines.map((line: { merchandise: { id: string } }) => line.merchandise.id)).toEqual([
    "gid://shopify/ProductVariant/demo-ryans-dad-name-tag-shirt-0",
  ]);
});

test("customer can change the design from the quick add panel", async ({ page }) => {
  await page.goto("/collections/all");
  await page.getByRole("button", { name: "Quick add Name Tag Shirt", exact: true }).click();
  const panel = page.getByRole("dialog", { name: "Quick add Name Tag Shirt" });
  await panel.getByRole("button", { name: /^Design/ }).click();
  await page.getByRole("option", { name: "Ryan’s Dad", exact: true }).click();
  await expect(panel.getByRole("button", { name: /^Design/ })).toContainText("Ryan’s Dad");
  // Each demo design comes in one color, which follows the design.
  await expect(panel).toContainText("Natural");
  await panel.getByRole("button", { name: "S", exact: true }).click();

  await expect(page.getByRole("dialog", { name: "Added to cart" }).getByText("Just added")).toBeVisible();
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
  await page.getByLabel("Size").click();
  await page.getByRole("option", { name: "S", exact: true }).click();
  await page.getByRole("button", { name: "Add to cart" }).click();
  await expect(page.getByRole("heading", { name: /^Added to cart/ })).toBeVisible();

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

test("customer can shop from the hero", async ({ page }) => {
  await page.goto("/");
  const hero = page.getByRole("region", { name: "Ryan Meetup merch", exact: true });
  await expect(hero.getByRole("heading", { level: 1 })).toHaveText("Merch with your name on it.");
  await expect(hero.getByRole("link", { name: "Browse collections" })).toHaveAttribute("href", "#collections");
  await hero.getByRole("link", { name: "Shop all merch" }).click();
  await expect(page).toHaveURL(/\/collections\/all$/);
});

test("the home page opens doors to collections, spotlights one listing, and keeps favorites short on phones", async ({ page }) => {
  await page.goto("/");
  const main = page.getByRole("main");
  const lanes = main.getByRole("region", { name: "Shop by collection" });
  // RY-Ds lives on the membership site, so only the two type pages are tiles.
  await expect(lanes.getByRole("listitem")).toHaveCount(2);
  await expect(lanes.getByRole("link", { name: /Apparel/ })).toHaveAttribute("href", "/apparel");

  const spotlight = main.getByRole("region", { name: "New arrival" });
  await expect(spotlight.getByRole("heading", { name: "Name Tag Shirt" })).toBeVisible();
  await spotlight.getByRole("link", { name: "Take a closer look" }).click();
  await expect(page).toHaveURL(/\/products\/name-tag-shirt/);

  await page.goBack();
  const favorites = main.getByRole("region", { name: "Best Sellers" });
  await expect(favorites.getByRole("heading", { level: 3 })).toHaveText([
    "Official Ryan Meetup Tee", "Hello, My Name Is Ryan Sweatshirt", "Ryan Society Cap", "Certified Ryan Pack", "Name Tag Shirt",
  ]);
  await expect(main.locator("section[aria-labelledby]").first()).toHaveAttribute("aria-labelledby", "home-favorites");
  await expect(main.getByRole("link", { name: "Shop All", exact: true })).toHaveCount(0);
  // The demo store has no policy or Markets, so the strip keeps only the always-true production line.
  const shipping = main.getByRole("region", { name: "Shipping and production" });
  await expect(shipping.getByRole("listitem")).toHaveText([/^Made to order:? ?Made for you, then it ships ?Shipping details$/]);
  await expect(shipping.getByRole("link", { name: "Shipping details" })).toHaveAttribute("href", "/policies/shipping-policy");
  // Products come straight after the hero; the support note follows the first shelf.
  await expect(main.locator("section[data-analytics-section]").nth(1)).toHaveAttribute("data-analytics-section", "home_favorites");
  await expect(main.locator("section[data-analytics-section]").nth(2)).toHaveAttribute("data-analytics-section", "home_support");
  await expect(main.locator("section[data-analytics-section]").nth(3)).toHaveAttribute("data-analytics-section", "home_shipping");

  // Phones keep the first four and offer the rest of the catalog.
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(favorites.getByRole("heading", { level: 3 })).toHaveText([
    "Official Ryan Meetup Tee", "Hello, My Name Is Ryan Sweatshirt", "Ryan Society Cap", "Certified Ryan Pack",
  ]);
  await expect(favorites.getByRole("link", { name: "See everything" })).toHaveAttribute("href", "/collections/all");
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
  // All sales are final: refunds are handled case by case, never offered as a choice.
  for (const field of ["What can we help with?", "Preferred resolution"]) {
    await page.getByLabel(new RegExp(`^${field.replace("?", "\\?")}`)).click();
    await expect(page.getByRole("option").first()).toBeVisible();
    await expect(page.getByRole("option", { name: /refund/i })).toHaveCount(0);
    await page.keyboard.press("Escape");
  }
  await page.getByLabel("First name").fill("Ryan");
  await page.getByLabel("Order number").fill("RM-1234");
  await expect(
    page.getByRole("button", { name: "Send to customer service" }),
  ).toBeVisible();
  await page.screenshot({
    path: screenshotPath("store-contact-dark.png"),
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: screenshotPath("store-contact-mobile.png"),
    fullPage: true,
  });
});

test("a help link from a Shopify order email fills in the order details", async ({ page }) => {
  await page.goto("/contact?order=1042&email=ryan%40example.com");
  await expect(page.getByLabel("Order number")).toHaveValue("#1042");
  await expect(page.getByLabel("Contact email")).toHaveValue("ryan@example.com");
  await expect(page.getByLabel("First name")).toHaveValue("");
});

test("customer can read about the store and get back to shopping", async ({ page }) => {
  await page.goto("/");
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.getByRole("navigation", { name: "Main navigation" }).getByRole("link", { name: "About" }).click();
  await expect(page).toHaveURL(/\/about$/);
  await expect(page.getByRole("main").getByRole("heading", { level: 1 })).toHaveText("Official goods. Unmistakably Ryan.");
  await expect(page.getByText("We can’t accept returns or exchanges", { exact: false })).toBeVisible();
  await expect(page.getByText("We ship to 28 countries and regions", { exact: false })).toBeVisible();
  await expect(page.getByText(/printful/i)).toHaveCount(0);
  await page.screenshot({ path: screenshotPath("store-about-desktop.png"), fullPage: true });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: screenshotPath("store-about-mobile.png"), fullPage: true });
  await page.getByRole("link", { name: "Shop the collection" }).click();
  await expect(page).toHaveURL(/\/collections\/all$/);
});

test("apparel, accessories, and collections are header menus ending in shop all", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/about");
  const mainNavigation = page.getByRole("navigation", { name: "Main navigation" });
  await expect(mainNavigation.getByRole("link", { name: "Shop All" })).toHaveCount(0);
  // The shared NavMenu opens on hover, as it does on ryanmeetup.com.
  await mainNavigation.getByRole("button", { name: "Collections" }).hover();
  // Case-sensitive, so a running sale banner's "Shop all" button doesn't match.
  await expect(page.getByRole("link", { name: /^Shop All\b/ })).toHaveAttribute("href", "/collections/all");
  await expect(page.getByRole("link", { name: /RY-Ds/ })).toHaveAttribute("href", "https://ryanmeetup.com/cards");
  await page.mouse.move(0, 0);
  await mainNavigation.getByRole("button", { name: "Apparel" }).hover();
  // Empty groupings are hidden, and the demo catalog's apparel is shirts and sweatshirts.
  await expect(page.getByRole("link", { name: /^T-Shirts/ })).toHaveAttribute("href", "/apparel/t-shirts");
  await page.getByRole("link", { name: "Shop All Apparel" }).click();
  await expect(page).toHaveURL(/\/apparel$/);

  // Close the desktop popover before switching to the mobile navigation.
  await page.mouse.move(0, 0);
  await mainNavigation.getByRole("button", { name: "Apparel" }).press("Escape");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Open navigation" }).click();
  const mobileNavigation = page.getByRole("navigation", { name: "Mobile navigation" });
  const toggle = mobileNavigation.getByRole("button", { name: /^Collections/ });
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await expect(mobileNavigation.getByRole("link", { name: "Shop All", exact: true })).toBeHidden();
  await toggle.click();
  await mobileNavigation.getByRole("link", { name: "Shop All", exact: true }).click();
  await expect(page).toHaveURL(/\/collections\/all$/);
  await expect(mobileNavigation).toBeHidden();

  // On a page from the menu, the group opens already expanded.
  await page.getByRole("button", { name: "Open navigation" }).click();
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
});

test("product breadcrumbs name the page the customer came from", async ({ page }) => {
  const breadcrumb = page.getByRole("navigation", { name: "Breadcrumb" });
  await page.goto("/apparel");
  await page.getByRole("main").getByRole("link", { name: /Ryan Meetup Tee/ }).first().getByRole("heading").click();
  await expect(page).toHaveURL(/\/products\/ryan-meetup-tee\?(.+&)?from=apparel/);
  await expect(breadcrumb.getByRole("listitem")).toHaveText([/^Store/, /^Apparel/, "Official Ryan Meetup Tee"]);
  await breadcrumb.getByRole("link", { name: "Apparel" }).click();
  await expect(page).toHaveURL(/\/apparel$/);

  await page.goto("/");
  await page.getByRole("main").getByRole("link", { name: /Ryan Meetup Tee/ }).first().getByRole("heading").click();
  await expect(page).toHaveURL(/\/products\/ryan-meetup-tee(\?|$)/);
  await expect(breadcrumb.getByRole("listitem")).toHaveText([/^Store/, "Official Ryan Meetup Tee"]);

  // A made-up origin is ignored rather than shown as a crumb.
  await page.goto("/products/ryan-meetup-tee?from=not-a-collection");
  await expect(breadcrumb.getByRole("listitem")).toHaveText([/^Store/, "Official Ryan Meetup Tee"]);
});

test("store navigation and breadcrumbs use icons", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/products/ryan-meetup-tee");
  // Desktop labels are text only, since six labels with icons overflow the pill at
  // 1280px; Apparel, Accessories, and Collections keep their menu chevrons.
  await expect(
    page.getByRole("navigation", { name: "Main navigation" }).locator("a svg"),
  ).toHaveCount(0);
  await expect(
    page.getByRole("navigation", { name: "Main navigation" }).locator("button svg"),
  ).toHaveCount(3);
  await expect(
    page.getByRole("navigation", { name: "Breadcrumb" }).locator("li svg"),
  ).toHaveCount(2);
  await page.screenshot({
    path: screenshotPath("store-product-breadcrumbs.png"),
    fullPage: false,
  });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Open navigation" }).click();
  // Every mobile link keeps its icon, however many groupings the catalog fills.
  const mobileLinks = page.getByRole("navigation", { name: "Mobile navigation" }).getByRole("link");
  await expect(mobileLinks.first()).toBeVisible();
  const icons = await mobileLinks.evaluateAll((links) => links.filter((link) => link.checkVisibility()).map((link) => [link.textContent, Boolean(link.querySelector("svg"))]));
  expect(icons.length).toBeGreaterThanOrEqual(5);
  expect(icons.filter(([, icon]) => !icon)).toEqual([]);
  await page.screenshot({
    path: screenshotPath("store-mobile-navigation.png"),
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
        name: "Merch with your name on it.",
      }),
    ).toBeVisible();
    if (viewport.name === "mobile") {
      await expect(
        page.getByRole("button", { name: "Open navigation" }),
      ).toBeVisible();
    }
    await page.screenshot({
      path: screenshotPath(`store-${viewport.name}.png`),
      fullPage: true,
    });
  });
}

test("RY-Ds in the mobile Collections menu goes directly to the membership site", async ({ page }) => {
  await page.route("https://ryanmeetup.com/cards", (route) => route.fulfill({ contentType: "text/html", body: "<h1>Membership cards</h1>" }));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByRole("button", { name: "Open navigation" }).click();
  const navigation = page.getByRole("navigation", { name: "Mobile navigation" });
  await navigation.getByRole("button", { name: /^Collections/ }).click();
  await expect(navigation.getByRole("link", { name: /RY-Ds/ })).toHaveAttribute("href", "https://ryanmeetup.com/cards");
  await navigation.getByRole("link", { name: /RY-Ds/ }).click();
  await expect(page).toHaveURL("https://ryanmeetup.com/cards");
});

test("retired RY-D store URLs redirect directly to the membership site", async ({ request }) => {
  for (const path of ["/collections/ryd", "/accessories/ryd"]) {
    const response = await request.get(path, { maxRedirects: 0 });
    expect(response.status()).toBe(308);
    expect(response.headers().location).toBe("https://ryanmeetup.com/cards");
  }
});
