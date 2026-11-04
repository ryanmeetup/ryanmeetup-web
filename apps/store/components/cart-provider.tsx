"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { Cart, CartLine, Product, ProductVariant } from "@/lib/types";

const storageKey = "ryan-store-cart";

type CartContextValue = {
  addItem: (product: Product, variant: ProductVariant, quantity: number) => Promise<void>;
  cart: Cart | null;
  /** Forgets the cart: after a completed checkout, or when the shopper empties it. */
  clearCart: () => void;
  commerceConfigured: boolean;
  drawerOpen: boolean;
  error: string;
  /** The variant id of the most recent addition, while the drawer shows it. */
  justAdded: string | null;
  loading: boolean;
  removeItem: (lineId: string) => Promise<void>;
  setDrawerOpen: (open: boolean) => void;
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
  const [drawerOpen, setDrawerOpenState] = useState(false);
  const [justAdded, setJustAdded] = useState<string | null>(null);
  // Counts cart changes, so a refresh that started before one doesn't overwrite its result.
  const changes = useRef(0);

  const saveCart = useCallback((nextCart: Cart | null) => {
    setCart(nextCart);
    try {
      if (nextCart) window.localStorage.setItem(storageKey, JSON.stringify(nextCart));
      else window.localStorage.removeItem(storageKey);
    } catch {
      // Storage can be blocked; the cart still works for this visit.
    }
  }, []);

  const setDrawerOpen = useCallback((open: boolean) => {
    setDrawerOpenState(open);
    if (!open) setJustAdded(null);
  }, []);

  const request = useCallback(async (payload: Record<string, unknown>) => {
    const response = await fetch("/api/cart", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    // A null cart means Shopify no longer has it: it checked out or expired.
    const data = (await response.json()) as { cart?: Cart | null; error?: string };
    if (!response.ok || data.cart === undefined) throw new Error(data.error || "Cart update failed.");
    return data.cart;
  }, []);

  const startChange = useCallback(() => {
    changes.current += 1;
    setLoading(true);
    setError("");
  }, []);

  // The stored cart is only a snapshot; Shopify's copy has current prices and drops a
  // cart once it checks out.
  const refreshCart = useCallback(
    async (stored: Cart) => {
      if (!commerceConfigured || stored.id.startsWith("demo-")) return;
      const startedAt = changes.current;
      try {
        const fresh = await request({ action: "get", cartId: stored.id });
        if (changes.current === startedAt) saveCart(fresh);
      } catch {
        // Keep the snapshot; the next change reports anything still wrong.
      }
    },
    [commerceConfigured, request, saveCart],
  );

  useEffect(() => {
    function readStored() {
      try {
        const stored = window.localStorage.getItem(storageKey);
        return stored ? (JSON.parse(stored) as Cart) : null;
      } catch {
        return null;
      }
    }
    const stored = readStored();
    if (stored) {
      // The server cannot read this guest-only localStorage cart, so hydrate it once after mount.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCart(stored);
      void refreshCart(stored);
    }
    // Coming back from checkout with the Back button restores this page without remounting it.
    function onPageShow(event: PageTransitionEvent) {
      const current = event.persisted ? readStored() : null;
      if (current) void refreshCart(current);
    }
    window.addEventListener("pageshow", onPageShow);
    return () => window.removeEventListener("pageshow", onPageShow);
  }, [refreshCart]);

  // Shopify keeps the abandoned cart until it expires; forgetting its ID is enough.
  const clearCart = useCallback(() => {
    changes.current += 1;
    setError("");
    setJustAdded(null);
    saveCart(null);
  }, [saveCart]);

  const addItem = useCallback(
    async (product: Product, variant: ProductVariant, quantity: number) => {
      startChange();
      try {
        if (commerceConfigured) {
          const cartId = cart?.id.startsWith("demo-") ? undefined : cart?.id;
          saveCart(await request({ action: "add", cartId, merchandiseId: variant.id, quantity }));
        } else {
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
        }
        setJustAdded(variant.id);
        setDrawerOpenState(true);
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "Cart update failed.");
        throw caught;
      } finally {
        setLoading(false);
      }
    },
    [cart, commerceConfigured, request, saveCart, startChange],
  );

  const updateItem = useCallback(
    async (lineId: string, quantity: number) => {
      if (quantity < 1) return;
      startChange();
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
    [cart, commerceConfigured, request, saveCart, startChange],
  );

  const removeItem = useCallback(
    async (lineId: string) => {
      startChange();
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
    [cart, commerceConfigured, request, saveCart, startChange],
  );

  const value = useMemo(
    () => ({ addItem, cart, clearCart, commerceConfigured, drawerOpen, error, justAdded, loading, removeItem, setDrawerOpen, updateItem }),
    [addItem, cart, clearCart, commerceConfigured, drawerOpen, error, justAdded, loading, removeItem, setDrawerOpen, updateItem],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) throw new Error("useCart must be used inside CartProvider.");
  return context;
}
