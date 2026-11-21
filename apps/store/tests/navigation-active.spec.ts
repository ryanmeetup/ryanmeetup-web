import { expect, test } from "@playwright/test";
import type { Locator } from "@playwright/test";

async function expectCurrent(navigation: Locator, label: string) {
  const current = navigation.locator("[aria-current]");
  await expect(current).toHaveCount(1);
  await expect(current).toHaveAccessibleName(label);
  // Check the rendered highlight as well as its accessibility state.
  await expect(navigation.locator('[class~="bg-black/15"]')).toHaveCount(1);
}

test("desktop headers highlight one canonical section for every route family", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1536, height: 900 });
  const navigation = page.getByRole("navigation", { name: "Main navigation", exact: true });
  for (const [path, label] of [
    ["/collections/all", "Collections"],
    ["/accessories", "Accessories"], ["/accessories/pins", "Accessories"],
    ["/apparel", "Apparel"], ["/apparel/hats", "Apparel"], ["/about", "About"], ["/reviews", "Reviews"], ["/contact", "Contact"],
    ["/products/ryan-meetup-tee", "Apparel"],
  ]) {
    await page.goto(path);
    await expectCurrent(navigation, label);
  }
  await page.goto("/collections/all");
  for (const width of [1280, 1536]) {
    await page.setViewportSize({ width, height: 900 });
    await expectCurrent(navigation, "Collections");
    await expect(navigation.getByRole("button", { name: "Accessories", exact: true })).not.toHaveClass(/bg-black\/15/);
    await page.screenshot({ path: testInfo.outputPath(`collection-header-${width}.png`), clip: { x: 0, y: 0, width, height: 260 } });
  }
});

test("client navigation clears product claims and selects only the destination section", async ({ page }) => {
  await page.setViewportSize({ width: 1536, height: 900 });
  await page.goto("/products/ryan-meetup-tee");
  const navigation = page.getByRole("navigation", { name: "Main navigation", exact: true });
  await expectCurrent(navigation, "Apparel");
  await navigation.getByRole("link", { name: "About", exact: true }).click();
  await expectCurrent(navigation, "About");
  await navigation.getByRole("button", { name: "Collections", exact: true }).hover();
  await page.getByRole("link", { name: /^Shop All Official/ }).click();
  await expect(page).toHaveURL(/\/collections\/all$/);
  await page.mouse.move(0, 500);
  await expectCurrent(navigation, "Collections");
  await navigation.getByRole("button", { name: "Apparel", exact: true }).hover();
  await page.getByRole("link", { name: /^T-Shirts/ }).click();
  await expectCurrent(navigation, "Apparel");
});

for (const width of [390, 1024]) {
  test(`mobile navigation gives each page one current link at ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 1000 }); await page.goto("/collections/all");
    await page.getByRole("button", { name: "Open navigation", exact: true }).click();
    const navigation = page.getByRole("navigation", { name: "Mobile navigation", exact: true });
    const collections = navigation.getByRole("button", { name: /^Collections/ });
    const accessories = navigation.getByRole("button", { name: /^Accessories/ });
    await expect(collections).toHaveAttribute("aria-expanded", "true");
    await expect(accessories).toHaveAttribute("aria-expanded", "false");
    await expect(navigation.locator('[aria-current="page"]')).toHaveCount(1);
    await expect(navigation.locator('[aria-current="page"]')).toHaveAttribute("href", "/collections/all");
    await page.screenshot({ path: testInfo.outputPath(`collection-mobile-${width}.png`) });
    await accessories.click();
    await expect(collections).toHaveAttribute("aria-expanded", "false");
    const shortcut = navigation.getByRole("link", { name: /^RY-Ds/ });
    await expect(shortcut).not.toHaveAttribute("aria-current");
    await collections.click();
    await navigation.getByRole("link", { name: "Shop All", exact: true }).click();
    await expect(navigation).toHaveCount(0);
    await page.getByRole("button", { name: "Open navigation", exact: true }).click();
    await expect(collections).toHaveAttribute("aria-expanded", "true");
    await expect(accessories).toHaveAttribute("aria-expanded", "false");
    await expect(navigation.locator('[aria-current="page"]')).toHaveCount(1);
  });
}
