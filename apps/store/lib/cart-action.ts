export type CartAction =
  | { action: "get"; cartId: string }
  | { action: "add"; cartId?: string; merchandiseId: string; quantity: number }
  | { action: "update"; cartId: string; lineId: string; quantity: number }
  | { action: "remove"; cartId: string; lineId: string };

/** More than any shopper orders of one item; keeps junk quantities away from Shopify. */
export const maxCartLineQuantity = 100;

function shopifyId(value: unknown, kind: "Cart" | "CartLine" | "ProductVariant"): value is string {
  return typeof value === "string" && value.length <= 512 && value.startsWith(`gid://shopify/${kind}/`) && !/[\s\u0000-\u001f\u007f]/u.test(value);
}

function quantity(value: unknown): value is number {
  return Number.isInteger(value) && (value as number) >= 1 && (value as number) <= maxCartLineQuantity;
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
    default:
      return null;
  }
}
