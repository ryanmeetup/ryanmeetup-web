import { expect, test } from "@playwright/test";

for (const viewport of [
  { width: 390, height: 844 },
  { width: 1024, height: 768 },
  { width: 1280, height: 900 },
  { width: 1536, height: 960 },
  { width: 1280, height: 600 },
]) {
  test(`product gallery stays compact and reachable at ${viewport.width}×${viewport.height}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto("/products/nametag-shirt");
    await expect(page.getByRole("button", { name: "Change to Light Mode" })).toHaveCSS("pointer-events", "auto");
    const gallery = page.getByRole("region", { name: "Product gallery" });
    const strip = gallery.getByRole("group", { name: "Product photos" });
    const photos = strip.getByRole("button");
    await expect(photos.first()).toHaveAttribute("aria-pressed", "true");
    const photoCount = await photos.count();
    const groups = strip.getByRole("group");
    await expect(groups).toHaveCount(2);
    for (const label of ["Ryan", "Ryan’s Dad"]) {
      const group = strip.getByRole("group", { name: `${label} photos`, exact: true });
      await expect(group.getByText(label, { exact: true })).toHaveCount(1);
      const count = await group.getByRole("button").count();
      await expect(group.getByText(`${count} ${count === 1 ? "photo" : "photos"}`, { exact: true })).toHaveCount(1);
      await expect(group).toHaveCSS("overflow-x", "hidden");
      const scroll = group.locator("[data-photo-scroll]");
      if (await scroll.evaluate((element) => element.scrollWidth > element.clientWidth)) {
        const frameBefore = await group.boundingBox();
        const labelBefore = await group.getByText(label, { exact: true }).boundingBox();
        await scroll.evaluate((element) => { element.scrollLeft = element.scrollWidth; });
        expect(await scroll.evaluate((element) => element.scrollLeft)).toBeGreaterThan(0);
        expect(await group.boundingBox()).toEqual(frameBefore);
        expect(await group.getByText(label, { exact: true }).boundingBox()).toEqual(labelBefore);
        await scroll.evaluate((element) => { element.scrollLeft = 0; });
      }
    }
    const rows = await photos.evaluateAll((buttons) => new Set(buttons.map((button) => button.getBoundingClientRect().top)).size);
    expect(rows).toBe(1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

    if (viewport.width >= 1024) {
      await expect(gallery).toHaveCSS("position", "sticky");
      const bounds = await gallery.boundingBox();
      expect(bounds!.height + 112).toBeLessThan(viewport.height);
      const details = await page.getByRole("heading", { name: "Nametag Shirt", exact: true }).locator("..").boundingBox();
      if (details!.height > bounds!.height + 2) {
        // Scroll within the available right-column content, keeping the gallery
        // clear of the site header. Short descriptions need no sticky interval.
        const top = bounds!.y - 112 + (details!.height - bounds!.height) / 2;
        await page.evaluate((top) => window.scrollTo({ top, behavior: "instant" }), top);
        await expect.poll(async () => (await gallery.boundingBox())!.y).toBeCloseTo(112, 0);
      }
    } else {
      await expect(gallery).toHaveCSS("position", "static");
    }

    await gallery.getByRole("button", { name: "Previous photo", exact: true }).click();
    await expect(gallery.getByRole("status")).toHaveText(`Photo ${photoCount} of ${photoCount}`);
    const selected = strip.locator('[aria-pressed="true"]');
    await expect(selected).toHaveCount(1);
    await expect.poll(() => selected.evaluate((button) => {
      const photoBounds = button.getBoundingClientRect();
      const containers = [button.parentElement!, button.closest('[aria-label="Product photos"]')!];
      return containers.every((container) => {
        const bounds = container.getBoundingClientRect();
        return photoBounds.left >= bounds.left && photoBounds.right <= bounds.right + 1;
      });
    })).toBe(true);
    await expect(page.getByRole("button", { name: "Add to cart", exact: true })).toBeEnabled();
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
    await page.screenshot({ path: `/private/tmp/store-product-${viewport.width}-${viewport.height}.png`, fullPage: true });
  });
}
