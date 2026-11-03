import type { Metadata } from "next";
import { CartPage } from "@/components/cart-page";

export const metadata: Metadata = { title: "Your cart", robots: { index: false, follow: false } };

// Nothing links here while the cart drawer is the only surfaced cart; the page
// stays reachable by URL so the two can be compared later.
export default function Page() {
  return <CartPage />;
}
