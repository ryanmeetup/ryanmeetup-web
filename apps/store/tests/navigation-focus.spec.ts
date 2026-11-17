import { expect, test } from "@playwright/test";

for (const theme of ["light", "dark"]) {
  test(`${theme} navigation distinguishes hover from keyboard focus`, async ({ page }) => {
    await page.addInitScript((value) => localStorage.setItem("theme", value), theme);
    await page.setViewportSize({ width: 1536, height: 900 });
    await page.goto("/about");
    const navigation = page.getByRole("navigation", { name: "Main navigation", exact: true });
    const apparel = navigation.getByRole("button", { name: "Apparel", exact: true });
    const ring = () => apparel.evaluate((element) => getComputedStyle(element).getPropertyValue("--tw-ring-shadow"));

    await apparel.hover();
    await expect(apparel).toHaveAttribute("aria-expanded", "true");
    await expect(page.locator(`[id="${await apparel.getAttribute("aria-controls")}"]`)).toHaveCSS("opacity", "1");
    await expect.poll(ring).not.toContain("2px");
    await page.screenshot({ path: `/private/tmp/store-nav-${theme}-hover.png`, clip: { x: 0, y: 0, width: 1536, height: 350 } });

    await apparel.press("Escape");
    await expect(page.getByRole("link", { name: /^T-Shirts/ })).toHaveCount(0);
    await page.mouse.move(0, 400);
    await navigation.getByRole("link", { name: "About", exact: true }).focus();
    await page.keyboard.press("Tab");
    await expect(apparel).toBeFocused();
    await expect.poll(ring).toContain("inset");
    await expect.poll(ring).toContain("2px");
    await apparel.press("Enter");
    const firstLink = page.getByRole("link", { name: /^T-Shirts/ });
    await expect(firstLink).toBeVisible();
    await expect(page.locator(`[id="${await apparel.getAttribute("aria-controls")}"]`)).toHaveCSS("opacity", "1");
    await apparel.press("Tab");
    await expect(firstLink).toBeFocused();
    await expect(firstLink).toHaveCSS("outline-style", "none");
    await expect.poll(() => firstLink.evaluate((element) => getComputedStyle(element).getPropertyValue("--tw-ring-shadow"))).toContain("inset");
    await expect.poll(() => firstLink.evaluate((element) => getComputedStyle(element).boxShadow)).toContain("2px");
    await page.screenshot({ path: `/private/tmp/store-nav-${theme}-keyboard.png`, clip: { x: 0, y: 0, width: 1536, height: 350 } });

    await page.setViewportSize({ width: 1280, height: 900 });
    await expect(apparel).toBeVisible();
    await page.screenshot({ path: `/private/tmp/store-nav-${theme}-1280.png`, clip: { x: 0, y: 0, width: 1280, height: 350 } });
    await apparel.press("Escape");
    await expect(firstLink).toHaveCount(0);
    for (const width of [1024, 390]) {
      await page.setViewportSize({ width, height: 844 });
      await expect(navigation).toBeHidden();
      await page.getByRole("button", { name: "Open navigation", exact: true }).click();
      await expect(page.getByRole("navigation", { name: "Mobile navigation", exact: true })).toBeVisible();
      await page.screenshot({ path: `/private/tmp/store-nav-${theme}-${width}.png` });
      await page.getByRole("button", { name: "Close navigation", exact: true }).click();
    }
  });
}

for (const theme of ["light", "dark"]) {
  test(`${theme} menu caret connects each panel to its trigger`, async ({ page }) => {
    await page.addInitScript((value) => localStorage.setItem("theme", value), theme);
    await page.goto("/about");
    const navigation = page.getByRole("navigation", { name: "Main navigation", exact: true });
    for (const width of [1280, 1536]) {
      await page.setViewportSize({ width, height: 900 });
      for (const title of ["Apparel", "Accessories", "Collections"]) {
        const trigger = navigation.getByRole("button", { name: title, exact: true });
        await trigger.hover();
        await expect(trigger).toHaveAttribute("aria-expanded", "true");
        const panel = page.locator(`[id="${await trigger.getAttribute("aria-controls")}"]`);
        await expect(panel).toHaveCSS("opacity", "1");
        const caret = panel.locator("[data-nav-caret]");
        await expect(caret).toBeVisible();
        const triggerBounds = (await trigger.boundingBox())!;
        const panelBounds = (await panel.boundingBox())!;
        const navigationBounds = (await navigation.boundingBox())!;
        expect(panelBounds.y).toBeGreaterThan(navigationBounds.y + navigationBounds.height);
        await expect.poll(async () => {
          const bounds = (await caret.boundingBox())!;
          return Math.abs(bounds.x + bounds.width / 2 - triggerBounds.x - triggerBounds.width / 2);
        }).toBeLessThan(2);
        // Move through the space below the button before entering the panel.
        await page.mouse.move(triggerBounds.x + triggerBounds.width / 2, triggerBounds.y + triggerBounds.height + 8, { steps: 5 });
        await expect(trigger).toHaveAttribute("aria-expanded", "true");
        await panel.getByRole("link").first().hover();
        await expect(trigger).toHaveAttribute("aria-expanded", "true");
        await page.screenshot({ path: `/private/tmp/store-caret-${theme}-${title.toLowerCase()}-${width}.png`, clip: { x: 0, y: 0, width, height: 470 } });
        await trigger.press("Escape");
        await expect(panel).toHaveCount(0);
        await page.mouse.move(0, 500);
      }
    }
  });
}
