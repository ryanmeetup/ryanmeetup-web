import { expect, test } from "@playwright/test";
import { getCompareAtPrice, getListingSale } from "../lib/money";

const usd = (amount: string) => ({ amount, currencyCode: "USD" });

test("only a compare-at price above the price counts as a sale", () => {
  expect(getCompareAtPrice({ price: usd("20.00"), compareAtPrice: usd("25.00") })).toEqual(usd("25.00"));
  expect(getCompareAtPrice({ price: usd("20.00"), compareAtPrice: usd("20.00") })).toBeNull();
  expect(getCompareAtPrice({ price: usd("20.00"), compareAtPrice: usd("15.00") })).toBeNull();
  expect(getCompareAtPrice({ price: usd("20.00"), compareAtPrice: null })).toBeNull();
  expect(getCompareAtPrice({ price: usd("20.00") })).toBeNull();
});

test("a listing strikes through an original price only beside its lowest price", () => {
  const listing = (variants: { price: ReturnType<typeof usd>; compareAtPrice?: ReturnType<typeof usd> | null }[]) => ({ priceRange: { minVariantPrice: usd("20.00") }, variants });

  expect(getListingSale(listing([{ price: usd("20.00"), compareAtPrice: usd("25.00") }, { price: usd("20.00"), compareAtPrice: usd("28.00") }]))).toEqual({ onSale: true, compareAt: usd("28.00") });
  // A markdown on a pricier size still marks the listing, with nothing to strike beside "From $20".
  expect(getListingSale(listing([{ price: usd("20.00") }, { price: usd("24.00"), compareAtPrice: usd("30.00") }]))).toEqual({ onSale: true, compareAt: null });
  expect(getListingSale(listing([{ price: usd("20.00") }, { price: usd("24.00") }]))).toEqual({ onSale: false, compareAt: null });
});
