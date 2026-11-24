import { NextResponse } from "next/server";
import { parseCartAction } from "@/lib/cart-action";
import {
  addCartLine,
  createCart,
  getCart,
  isShopifyConfigured,
  removeCartLine,
  ShopifyUserError,
  updateCartLine,
  updateCartNote,
} from "@/lib/shopify";
import type { Cart } from "@/lib/types";

// A cart that has checked out or expired rejects every change. When a change fails and
// Shopify no longer has the cart, fall back instead of leaving the shopper stuck with it.
async function withLiveCart(cartId: string, change: () => Promise<Cart>, fallback: () => Promise<Cart | null>) {
  try {
    return await change();
  } catch (error) {
    if (await getCart(cartId)) throw error;
    return fallback();
  }
}

async function runCartAction(body: NonNullable<ReturnType<typeof parseCartAction>>): Promise<Cart | null> {
  switch (body.action) {
    case "get":
      return getCart(body.cartId);
    case "add": {
      const { cartId, merchandiseId, quantity } = body;
      return cartId
        ? withLiveCart(cartId, () => addCartLine(cartId, merchandiseId, quantity), () => createCart(merchandiseId, quantity))
        : createCart(merchandiseId, quantity);
    }
    case "update":
      return withLiveCart(body.cartId, () => updateCartLine(body.cartId, body.lineId, body.quantity), async () => null);
    case "remove":
      return withLiveCart(body.cartId, () => removeCartLine(body.cartId, body.lineId), async () => null);
    case "note":
      return withLiveCart(body.cartId, () => updateCartNote(body.cartId, body.note), async () => null);
  }
}

export async function POST(request: Request) {
  if (!isShopifyConfigured()) {
    return NextResponse.json({ demo: true });
  }

  const body = parseCartAction(await request.json().catch(() => null));
  if (!body) return NextResponse.json({ error: "That cart change could not be read. Please refresh and try again." }, { status: 400 });

  try {
    return NextResponse.json({ cart: await runCartAction(body) });
  } catch (error) {
    // Shopify's own refusals (stock limits, unavailable items) are written for shoppers.
    if (error instanceof ShopifyUserError) return NextResponse.json({ error: error.message }, { status: 422 });
    console.error("Cart request failed.", error);
    return NextResponse.json({ error: "The cart couldn't be updated just now. Please try again." }, { status: 502 });
  }
}
