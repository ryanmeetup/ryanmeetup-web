import type { Cart } from "./types";

type Shape = Record<string, unknown>;
const isObject = (value: unknown): value is Shape => Boolean(value) && typeof value === "object" && !Array.isArray(value);
const isMoney = (value: unknown) => isObject(value) && typeof value.amount === "string" && typeof value.currencyCode === "string";

function isLine(value: unknown) {
  if (!isObject(value) || typeof value.id !== "string" || !Number.isInteger(value.quantity)) return false;
  const merchandise = value.merchandise;
  return isObject(merchandise) && typeof merchandise.id === "string" && isMoney(merchandise.price) &&
    Array.isArray(merchandise.selectedOptions) && isObject(merchandise.product) &&
    typeof merchandise.product.handle === "string" && typeof merchandise.product.title === "string";
}

/**
 * The cart snapshot saved in this browser, or null when it is missing or no
 * longer has the shape the storefront renders. A snapshot from an older
 * release must never break every page; the shopper just starts a new cart.
 */
export function parseStoredCart(stored: string | null): Cart | null {
  if (!stored) return null;
  try {
    const value: unknown = JSON.parse(stored);
    return isObject(value) && typeof value.id === "string" && typeof value.checkoutUrl === "string" &&
      Number.isInteger(value.totalQuantity) && isObject(value.cost) && isMoney(value.cost.subtotalAmount) &&
      isMoney(value.cost.totalAmount) && Array.isArray(value.lines) && value.lines.every(isLine)
      ? value as Cart
      : null;
  } catch {
    return null;
  }
}
