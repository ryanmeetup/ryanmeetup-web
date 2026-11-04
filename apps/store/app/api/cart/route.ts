import { NextResponse } from "next/server";
import {
  addCartLine,
  createCart,
  getCart,
  isShopifyConfigured,
  removeCartLine,
  updateCartLine,
} from "@/lib/shopify";
import type { Cart } from "@/lib/types";

type CartAction =
  | { action: "get"; cartId: string }
  | { action: "add"; cartId?: string; merchandiseId: string; quantity: number }
  | { action: "update"; cartId: string; lineId: string; quantity: number }
  | { action: "remove"; cartId: string; lineId: string };

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

export async function POST(request: Request) {
  if (!isShopifyConfigured()) {
    return NextResponse.json({ demo: true });
  }

  try {
    const body = (await request.json()) as CartAction;
    if (body.action === "get") {
      return NextResponse.json({ cart: await getCart(body.cartId) });
    }
    if (body.action === "add") {
      const { cartId, merchandiseId, quantity } = body;
      const cart = cartId
        ? await withLiveCart(cartId, () => addCartLine(cartId, merchandiseId, quantity), () => createCart(merchandiseId, quantity))
        : await createCart(merchandiseId, quantity);
      return NextResponse.json({ cart });
    }
    if (body.action === "update") {
      return NextResponse.json({
        cart: await withLiveCart(body.cartId, () => updateCartLine(body.cartId, body.lineId, body.quantity), async () => null),
      });
    }
    if (body.action === "remove") {
      return NextResponse.json({
        cart: await withLiveCart(body.cartId, () => removeCartLine(body.cartId, body.lineId), async () => null),
      });
    }
    return NextResponse.json({ error: "Unknown cart action." }, { status: 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Cart request failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
