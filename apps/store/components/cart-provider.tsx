"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { cartUnavailableMessage, readCartResponse } from "@/lib/cart-action";
import { parseStoredCart } from "@/lib/stored-cart";
import { trackStoreEvent } from "@/lib/analytics";
import type { Cart, CartLine, Product, ProductVariant } from "@/lib/types";

const storageKey = "ryan-store-cart";


type CartContextValue = {
  addItem: (product: Product, variant: ProductVariant, quantity: number, source?: "product_page" | "quick_add") => Promise<void>;
  cart: Cart | null;
  /** Forgets the cart: after a completed checkout, or when the shopper empties it. */
  clearCart: () => void;
  commerceConfigured: boolean;
  drawerOpen: boolean;
  error: string;
  /** The variant id of the most recent addition, while the drawer shows it. */
  justAdded: string | null;
  loading: boolean;
  /** The order note as the shopper sees it: their unsaved typing, else the cart's saved note. */
  note: string;
  /** True while the note field holds text the cart hasn't saved yet. */
  noteChanged: boolean;
  removeItem: (lineId: string) => Promise<void>;
  /**
   * Saves the note when it changed and resolves with the cart that has it, so
   * checkout can wait for a note typed just before the click. Failures set
   * `error` and reject.
   */
  saveNote: () => Promise<Cart | null>;
  setNote: (note: string) => void;
  setDrawerOpen: (open: boolean, source?: "navigation" | "product_page") => void;
  updateItem: (lineId: string, quantity: number) => Promise<void>;
};

const CartContext = createContext<CartContextValue | null>(null);

function demoCart(lines: CartLine[], note?: string | null): Cart {
  const amount = lines.reduce(
    (total, line) => total + Number(line.merchandise.price.amount) * line.quantity,
    0,
  );
  const currencyCode = lines[0]?.merchandise.price.currencyCode ?? "USD";
  return {
    id: "demo-cart",
    checkoutUrl: "",
    note: note ?? null,
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
  // Null until the shopper edits the note; then their text wins over refreshes until it's saved.
  const [noteDraft, setNoteDraft] = useState<string | null>(null);
  // Counts cart changes, so a refresh that started before one doesn't overwrite its result.
  const changes = useRef(0);
  // Development uses Vercel's logging-only script; production demo carts aren't sales signals.
  const recordCommerce = commerceConfigured || process.env.NODE_ENV === "development";

  const saveCart = useCallback((nextCart: Cart | null) => {
    setCart(nextCart);
    try {
      if (nextCart) window.localStorage.setItem(storageKey, JSON.stringify(nextCart));
      else window.localStorage.removeItem(storageKey);
    } catch {
      // Storage can be blocked; the cart still works for this visit.
    }
  }, []);

  const setDrawerOpen = useCallback((open: boolean, source: "navigation" | "product_page" = "navigation") => {
    if (open !== drawerOpen) {
      if (open) trackStoreEvent("cart_drawer_opened", { quantity: cart?.totalQuantity ?? 0, source });
      else trackStoreEvent("cart_drawer_closed", { quantity: cart?.totalQuantity ?? 0 });
    }
    setDrawerOpenState(open);
    if (!open) setJustAdded(null);
  }, [cart?.totalQuantity, drawerOpen]);

  const request = useCallback(async (payload: Record<string, unknown>) => {
    const response = await fetch("/api/cart", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }).catch(() => {
      trackStoreEvent("cart_error", { operation: String(payload.action), reason: "network" });
      throw new Error(cartUnavailableMessage);
    });
    try {
      return await readCartResponse(response);
    } catch (error) {
      trackStoreEvent("cart_error", { operation: String(payload.action), reason: response.ok ? "invalid_response" : response.status >= 500 ? "server" : "rejected" });
      throw error;
    }
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
        return parseStoredCart(window.localStorage.getItem(storageKey));
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
    if (recordCommerce && cart?.totalQuantity) trackStoreEvent("cart_emptied", { quantity: cart.totalQuantity });
    changes.current += 1;
    setError("");
    setJustAdded(null);
    setNoteDraft(null);
    saveCart(null);
  }, [cart, recordCommerce, saveCart]);

  const addItem = useCallback(
    async (product: Product, variant: ProductVariant, quantity: number, source: "product_page" | "quick_add" = "product_page") => {
      startChange();
      try {
        let nextQuantity = (cart?.totalQuantity ?? 0) + quantity;
        let added = true;
        if (commerceConfigured) {
          const cartId = cart?.id.startsWith("demo-") ? undefined : cart?.id;
          const next = await request({ action: "add", cartId, merchandiseId: variant.id, quantity });
          saveCart(next);
          added = Boolean(next);
          nextQuantity = next?.totalQuantity ?? 0;
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
          saveCart(demoCart(lines, cart?.note));
        }
        if (recordCommerce && added) trackStoreEvent("add_to_cart", { product: product.handle, source });
        if (!drawerOpen && added) trackStoreEvent("cart_drawer_opened", { quantity: nextQuantity, source: "add_to_cart" });
        setJustAdded(variant.id);
        setDrawerOpenState(true);
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : cartUnavailableMessage);
        throw caught;
      } finally {
        setLoading(false);
      }
    },
    [cart, commerceConfigured, drawerOpen, recordCommerce, request, saveCart, startChange],
  );

  const updateItem = useCallback(
    async (lineId: string, quantity: number) => {
      if (quantity < 1) return;
      startChange();
      try {
        const line = cart?.lines.find((entry) => entry.id === lineId);
        let savedQuantity = quantity;
        if (commerceConfigured && cart) {
          const next = await request({ action: "update", cartId: cart.id, lineId, quantity });
          saveCart(next);
          savedQuantity = next?.lines.find((entry) => entry.id === lineId)?.quantity ?? 0;
        } else {
          saveCart(demoCart((cart?.lines ?? []).map((line) => (line.id === lineId ? { ...line, quantity } : line)), cart?.note));
        }
        if (recordCommerce && line && line.quantity !== savedQuantity) trackStoreEvent("cart_quantity_changed", { product: line.merchandise.product.handle, quantity: savedQuantity });
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : cartUnavailableMessage);
      } finally {
        setLoading(false);
      }
    },
    [cart, commerceConfigured, recordCommerce, request, saveCart, startChange],
  );

  const removeItem = useCallback(
    async (lineId: string) => {
      startChange();
      try {
        const line = cart?.lines.find((entry) => entry.id === lineId);
        if (commerceConfigured && cart) {
          saveCart(await request({ action: "remove", cartId: cart.id, lineId }));
        } else {
          const lines = (cart?.lines ?? []).filter((line) => line.id !== lineId);
          saveCart(lines.length ? demoCart(lines, cart?.note) : null);
        }
        if (recordCommerce && line) trackStoreEvent("remove_from_cart", { product: line.merchandise.product.handle, quantity: line.quantity });
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : cartUnavailableMessage);
      } finally {
        setLoading(false);
      }
    },
    [cart, commerceConfigured, recordCommerce, request, saveCart, startChange],
  );

  const savedNote = cart?.note ?? "";
  const note = noteDraft ?? savedNote;
  const noteChanged = noteDraft !== null && noteDraft.trim() !== savedNote;

  // Leaving the note field and pressing Checkout both save it; they share one request.
  const pendingNote = useRef<Promise<Cart | null> | null>(null);
  const saveNote = useCallback((): Promise<Cart | null> => {
    if (pendingNote.current) return pendingNote.current;
    if (!cart || !noteChanged) {
      setNoteDraft(null);
      return Promise.resolve(cart);
    }
    const next = note.trim();
    startChange();
    const save = (async () => {
      try {
        const saved = commerceConfigured && !cart.id.startsWith("demo-")
          ? await request({ action: "note", cartId: cart.id, note: next })
          : { ...cart, note: next };
        saveCart(saved);
        setNoteDraft(null);
        return saved;
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : cartUnavailableMessage);
        throw caught;
      } finally {
        setLoading(false);
        pendingNote.current = null;
      }
    })();
    pendingNote.current = save;
    return save;
  }, [cart, commerceConfigured, note, noteChanged, request, saveCart, startChange]);

  const value = useMemo(
    () => ({ addItem, cart, clearCart, commerceConfigured, drawerOpen, error, justAdded, loading, note, noteChanged, removeItem, saveNote, setDrawerOpen, setNote: setNoteDraft, updateItem }),
    [addItem, cart, clearCart, commerceConfigured, drawerOpen, error, justAdded, loading, note, noteChanged, removeItem, saveNote, setDrawerOpen, updateItem],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) throw new Error("useCart must be used inside CartProvider.");
  return context;
}
