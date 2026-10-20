import { expect, test } from "@playwright/test";

test("floating photo controls wrap across designs and keep keyboard focus", async ({ page }) => {
  await page.goto("/products/nametag-shirt");
  const gallery = page.getByRole("region", { name: "Product gallery" });
  const next = gallery.getByRole("button", { name: "Next photo", exact: true });
  const previous = gallery.getByRole("button", { name: "Previous photo", exact: true });
  const status = gallery.getByRole("status");
  await expect(next).toHaveAttribute("aria-keyshortcuts", "ArrowRight");
  await expect(previous).toHaveAttribute("aria-keyshortcuts", "ArrowLeft");
  await expect(status).toHaveText("Photo 1 of 2");

  await next.click();
  await expect(status).toHaveText("Photo 2 of 2");
  await expect(page.getByLabel("Nametag design")).toContainText("Ryan’s Dad");
  await expect(page.getByLabel("Color")).toContainText("Natural");
  await expect(next).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(status).toHaveText("Photo 1 of 2");
  await expect(next).toBeFocused();

  await previous.click();
  await expect(status).toHaveText("Photo 2 of 2");
  await expect(previous).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(status).toHaveText("Photo 1 of 2");
  await expect(previous).toBeFocused();
  await expect(gallery.getByRole("button", { name: "View Ryan image 1", exact: true })).toHaveAttribute("aria-pressed", "true");
});

test("arrow shortcuts browse photos without taking over product fields or modified keys", async ({ page }) => {
  await page.goto("/products/nametag-shirt");
  await expect(page.getByRole("button", { name: "Change to Light Mode" })).toHaveCSS("pointer-events", "auto");
  const gallery = page.getByRole("region", { name: "Product gallery" });
  const status = gallery.getByRole("status");

  await page.keyboard.press("ArrowRight");
  await expect(status).toHaveText("Photo 2 of 2");
  await page.keyboard.press("ArrowRight");
  await expect(status).toHaveText("Photo 1 of 2");
  await page.keyboard.press("ArrowLeft");
  await expect(status).toHaveText("Photo 2 of 2");
  await page.keyboard.press("Shift+ArrowRight");
  await expect(status).toHaveText("Photo 2 of 2");

  const design = page.getByLabel("Nametag design");
  await design.focus();
  await page.keyboard.press("ArrowLeft");
  await expect(status).toHaveText("Photo 2 of 2");
  await expect(design).toBeFocused();
  await design.click();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("Escape");
  await expect(status).toHaveText("Photo 2 of 2");

  const next = gallery.getByRole("button", { name: "Next photo", exact: true });
  await next.focus();
  await page.keyboard.press("ArrowRight");
  await expect(status).toHaveText("Photo 1 of 2");
  await expect(next).toBeFocused();
});

test("single-photo products omit navigation and leave arrow keys alone", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/products/ryan-meetup-tee");
  await expect(page.getByRole("button", { name: "Change to Light Mode" })).toHaveCSS("pointer-events", "auto");
  const gallery = page.getByRole("region", { name: "Product gallery" });
  const image = gallery.getByRole("img");
  const original = await image.getAttribute("src");
  await expect(gallery.getByRole("button", { name: /^(Previous|Next) photo$/ })).toHaveCount(0);
  await expect(gallery.getByRole("status")).toHaveCount(0);
  await page.keyboard.press("ArrowLeft");
  await page.keyboard.press("ArrowRight");
  await expect(image).toHaveAttribute("src", original!);
  expect(errors).toEqual([]);
});

test("old Mom design links reopen the corrected Dad shirt", async ({ page }) => {
  for (const url of [
    "/products/ryans-mom-name-tag-shirt",
    "/products/nametag-shirt?design=ryans-mom",
    "/products/nametag-shirt?design=ryans-mom-name-tag-shirt",
  ]) {
    await page.goto(url);
    await expect(page).toHaveURL(/\/products\/nametag-shirt\?design=ryans-dad-name-tag-shirt$/);
    await expect(page.getByLabel("Nametag design")).toContainText("Ryan’s Dad");
    await expect(page.getByRole("region", { name: "Product gallery" }).getByRole("button", { name: "View Ryan’s Dad image 1", exact: true })).toHaveAttribute("aria-pressed", "true");
  }
});
