import type { Cart } from "./types";

/** Shown when a cart change fails without a reason written for shoppers. */
export const cartUnavailableMessage = "The cart couldn't be updated just now. Please try again.";

export type CartAction =
  | { action: "get"; cartId: string }
  | { action: "add"; cartId?: string; merchandiseId: string; quantity: number }
  | { action: "update"; cartId: string; lineId: string; quantity: number }
  | { action: "remove"; cartId: string; lineId: string }
  | { action: "note"; cartId: string; note: string };

/** More than any shopper orders of one item; keeps junk quantities away from Shopify. */
export const maxCartLineQuantity = 100;

/** Room for a request or a few kind words; Shopify shows it on the order. */
export const maxCartNoteLength = 500;

function shopifyId(value: unknown, kind: "Cart" | "CartLine" | "ProductVariant"): value is string {
  return typeof value === "string" && value.length <= 512 && value.startsWith(`gid://shopify/${kind}/`) && !/[\s\u0000-\u001f\u007f]/u.test(value);
}

function quantity(value: unknown): value is number {
  return Number.isInteger(value) && (value as number) >= 1 && (value as number) <= maxCartLineQuantity;
}

// Line breaks and tabs are fine in a note; other control characters are not.
function cartNote(value: unknown): value is string {
  return typeof value === "string" && value.length <= maxCartNoteLength && !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(value);
}

/** The browser's cart request, or null when it is malformed. Shopify still enforces stock and ownership. */
export function parseCartAction(value: unknown): CartAction | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const body = value as Record<string, unknown>;
  switch (body.action) {
    case "get":
      return shopifyId(body.cartId, "Cart") ? { action: "get", cartId: body.cartId } : null;
    case "add":
      if (body.cartId !== undefined && !shopifyId(body.cartId, "Cart")) return null;
      return shopifyId(body.merchandiseId, "ProductVariant") && quantity(body.quantity)
        ? { action: "add", cartId: body.cartId as string | undefined, merchandiseId: body.merchandiseId, quantity: body.quantity }
        : null;
    case "update":
      return shopifyId(body.cartId, "Cart") && shopifyId(body.lineId, "CartLine") && quantity(body.quantity)
        ? { action: "update", cartId: body.cartId, lineId: body.lineId, quantity: body.quantity }
        : null;
    case "remove":
      return shopifyId(body.cartId, "Cart") && shopifyId(body.lineId, "CartLine")
        ? { action: "remove", cartId: body.cartId, lineId: body.lineId }
        : null;
    case "note":
      return shopifyId(body.cartId, "Cart") && cartNote(body.note)
        ? { action: "note", cartId: body.cartId, note: body.note }
        : null;
    default:
      return null;
  }
}

/**
 * The cart from an /api/cart response; null means Shopify no longer has it
 * (it checked out or expired). Failures throw a message fit for shoppers:
 * the server's own wording, or a generic one, never a parser error from a
 * gateway's HTML page.
 */
export async function readCartResponse(response: Response): Promise<Cart | null> {
  const data = (await response.json().catch(() => ({}))) as { cart?: Cart | null; error?: unknown };
  if (!response.ok || data.cart === undefined) {
    throw new Error(typeof data.error === "string" && data.error ? data.error : cartUnavailableMessage);
  }
  return data.cart;
}
