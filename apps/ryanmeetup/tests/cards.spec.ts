import { expect, test } from "@playwright/test";

test("sends card order help straight to P&M Apparel", async ({ page }) => {
  await page.goto("/cards");

  const support = page.getByRole("link", { name: "Email Ryan at P&M" });
  await expect(support).toHaveAttribute(
    "href",
    /^mailto:Ryan@pmapparel\.com\?subject=RY-D%20Order%20Support&body=/,
  );
});

test("links the order button to the P&M store", async ({ page }) => {
  await page.goto("/cards");

  const order = page.getByRole("link", { name: "Buy now" });
  await expect(order).toHaveAttribute(
    "href",
    "https://pmapparel.chipply.com/ryds/",
  );
  await expect(order).toHaveAttribute("target", "_blank");
});
