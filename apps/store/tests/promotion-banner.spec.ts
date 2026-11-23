import { expect, test } from "@playwright/test";

// Inside the Black RYDay window, so the browser's clock keeps the banner up whatever today is.
const duringSale = new Date("2026-11-25T17:00:00Z");

for (const width of [390, 1280]) {
  test(`the sale banner can be dismissed for good at ${width}px`, async ({ page }) => {
    await page.clock.setFixedTime(duringSale);
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    const banner = page.getByRole("complementary", { name: "Black RYDay sale", exact: true });
    const shopAll = banner.getByRole("link", { name: "Shop all", exact: true });
    const dismiss = banner.getByRole("button", { name: "Dismiss Black RYDay banner", exact: true });
    const hero = page.getByRole("region", { name: "Ryan Meetup merch", exact: true });
    const heroNote = hero.getByText("Black RYDay:", { exact: true });
    await expect(shopAll).toBeVisible();
    await expect(dismiss).toBeVisible();
    // The banner says it once; the hero stays quiet until the banner is gone.
    await expect(heroNote).toHaveCount(0);
    // On phones the link takes the row beside the dismiss button.
    const link = (await shopAll.boundingBox())!;
    const close = (await dismiss.boundingBox())!;
    if (width < 640) expect(link.width + close.width).toBeGreaterThan(width * 0.8);
    else expect(link.width).toBeLessThan(200);
    await dismiss.click();
    await expect(banner).toHaveCount(0);
    await expect(heroNote).toBeVisible();
    await page.reload();
    await expect(page.getByRole("heading", { name: /Merch with your/ })).toBeVisible();
    await expect(banner).toHaveCount(0);
    await expect(heroNote).toBeVisible();
  });
}
