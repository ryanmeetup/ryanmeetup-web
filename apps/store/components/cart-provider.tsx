"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { Cart, CartLine, Product, ProductVariant } from "@/lib/types";

const storageKey = "ryan-store-cart";

type CartContextValue = {
  addItem: (product: Product, variant: ProductVariant, quantity: number) => Promise<void>;
  cart: Cart | null;
  commerceConfigured: boolean;
  error: string;
  loading: boolean;
  removeItem: (lineId: string) => Promise<void>;
  updateItem: (lineId: string, quantity: number) => Promise<void>;
};

const CartContext = createContext<CartContextValue | null>(null);

function demoCart(lines: CartLine[]): Cart {
  const amount = lines.reduce(
    (total, line) => total + Number(line.merchandise.price.amount) * line.quantity,
    0,
  );
  const currencyCode = lines[0]?.merchandise.price.currencyCode ?? "USD";
  return {
    id: "demo-cart",
    checkoutUrl: "",
    lines,
    totalQuantity: lines.reduce((total, line) => total + line.quantity, 0),
    cost: {
      subtotalAmount: { amount: amount.toFixed(2), currencyCode },
      totalAmount: { amount: amount.toFixed(2), currencyCode },
    },
  };
}

export function CartProvider({
  children,
  commerceConfigured,
}: {
  children: React.ReactNode;
  commerceConfigured: boolean;
}) {
  const [cart, setCart] = useState<Cart | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const stored = window.localStorage.getItem(storageKey);
    if (!stored) return;
    try {
      // The server cannot read this guest-only localStorage cart, so hydrate it once after mount.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCart(JSON.parse(stored) as Cart);
    } catch {
      window.localStorage.removeItem(storageKey);
    }
  }, []);

  const saveCart = useCallback((nextCart: Cart | null) => {
    setCart(nextCart);
    if (nextCart) window.localStorage.setItem(storageKey, JSON.stringify(nextCart));
    else window.localStorage.removeItem(storageKey);
  }, []);

  const request = useCallback(async (payload: Record<string, unknown>) => {
    const response = await fetch("/api/cart", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = (await response.json()) as { cart?: Cart; error?: string };
    if (!response.ok || !data.cart) throw new Error(data.error || "Cart update failed.");
    return data.cart;
  }, []);

  const addItem = useCallback(
    async (product: Product, variant: ProductVariant, quantity: number) => {
      setLoading(true);
      setError("");
      try {
        if (commerceConfigured) {
          const cartId = cart?.id.startsWith("demo-") ? undefined : cart?.id;
          saveCart(await request({ action: "add", cartId, merchandiseId: variant.id, quantity }));
          return;
        }
        const existing = cart?.lines.find((line) => line.merchandise.id === variant.id);
        const lines = existing
          ? (cart?.lines ?? []).map((line) =>
              line.id === existing.id ? { ...line, quantity: line.quantity + quantity } : line,
            )
          : [
              ...(cart?.lines ?? []),
              {
                id: `demo-line-${variant.id}`,
                quantity,
                merchandise: {
                  ...variant,
                  product: { handle: product.handle, title: product.title, tags: product.tags },
                },
              },
            ];
        saveCart(demoCart(lines));
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "Cart update failed.");
        throw caught;
      } finally {
        setLoading(false);
      }
    },
    [cart, commerceConfigured, request, saveCart],
  );

  const updateItem = useCallback(
    async (lineId: string, quantity: number) => {
      if (quantity < 1) return;
      setLoading(true);
      setError("");
      try {
        if (commerceConfigured && cart) {
          saveCart(await request({ action: "update", cartId: cart.id, lineId, quantity }));
        } else {
          saveCart(demoCart((cart?.lines ?? []).map((line) => (line.id === lineId ? { ...line, quantity } : line))));
        }
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "Cart update failed.");
      } finally {
        setLoading(false);
      }
    },
    [cart, commerceConfigured, request, saveCart],
  );

  const removeItem = useCallback(
    async (lineId: string) => {
      setLoading(true);
      setError("");
      try {
        if (commerceConfigured && cart) {
          saveCart(await request({ action: "remove", cartId: cart.id, lineId }));
        } else {
          const lines = (cart?.lines ?? []).filter((line) => line.id !== lineId);
          saveCart(lines.length ? demoCart(lines) : null);
        }
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "Cart update failed.");
      } finally {
        setLoading(false);
      }
    },
    [cart, commerceConfigured, request, saveCart],
  );

  const value = useMemo(
    () => ({ addItem, cart, commerceConfigured, error, loading, removeItem, updateItem }),
    [addItem, cart, commerceConfigured, error, loading, removeItem, updateItem],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) throw new Error("useCart must be used inside CartProvider.");
  return context;
}
