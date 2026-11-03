import { expect, test } from "@playwright/test";
import type { Cart } from "../lib/types";
import { sortOptionValues } from "../lib/product-options";
import { tee } from "./fixtures/products";

const defaultProduct = {
  ...tee,
  variants: [{
    ...tee.variants[0],
    id: "gid://shopify/ProductVariant/test-default-title",
    title: "Default Title",
    selectedOptions: [{ name: "Title", value: "Default Title" }],
  }],
};

test("cart hides the placeholder while preserving real options and stored merchandise", async ({ page }) => {
  const price = tee.variants[0].price;
  const cart: Cart = {
    id: "demo-cart",
    checkoutUrl: "",
    totalQuantity: 2,
    cost: { subtotalAmount: price, totalAmount: price },
    lines: [defaultProduct, tee].map((product, index) => ({
      id: `option-test-${index}`,
      quantity: 1,
      merchandise: {
        ...product.variants[0],
        product: { handle: product.handle, title: index === 0 ? "Default option product" : "Size and color product" },
      },
    })),
  };
  await page.addInitScript((cart) => localStorage.setItem("ryan-store-cart", JSON.stringify(cart)), cart);
  await page.goto("/cart");
  const main = page.getByRole("main");
  await expect(main.getByText("Default option product", { exact: true })).toBeVisible();
  await expect(main.getByText("Default Title", { exact: true })).toHaveCount(0);
  await expect(main.getByText("Size: One size", { exact: true })).toBeVisible();
  await expect(main.getByText("Size: S · Color: Black", { exact: true })).toBeVisible();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("ryan-store-cart")!))).toEqual(cart);
});

test("one-size products say so where the size field would be", async ({ page }) => {
  await page.goto("/products/ryan-society-cap");
  const main = page.getByRole("main");
  await expect(main.getByText("One size", { exact: true })).toBeVisible();
  await expect(main.getByLabel("Size")).toHaveCount(0);
});

test("sizes sort smallest first and unrecognized sizes keep Shopify's order", () => {
  const size = (values: string[]) => sortOptionValues({ name: "Size", values }).values;
  expect(size(["M", "L", "XL", "2XL", "3XL", "4XL", "5XL", "S"])).toEqual(["S", "M", "L", "XL", "2XL", "3XL", "4XL", "5XL"]);
  expect(size(["XXL", "XS", "M"])).toEqual(["XS", "M", "XXL"]);
  expect(size(["M", "Toddler", "S"])).toEqual(["M", "Toddler", "S"]);
  expect(sortOptionValues({ name: "Color", values: ["M", "S"] }).values).toEqual(["M", "S"]);
});
