"use client";

import { useEffect } from "react";
import { useCart } from "./cart-provider";

/** Forgets the cart once checkout returns, so the next order starts empty. */
export function ClearCart() {
  const { clearCart } = useCart();
  useEffect(() => clearCart(), [clearCart]);
  return null;
}
