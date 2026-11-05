import { CartPage } from "@/components/cart-page";
import { buildPageMetadata, DEFAULT_IMAGE } from "@/lib/metadata";

export const metadata = buildPageMetadata({
  title: "Your cart",
  description: "Review your Ryan goods before checkout.",
  canonical: "/cart",
  image: DEFAULT_IMAGE,
  robots: { index: false, follow: false },
});

// Nothing links here while the cart drawer is the only surfaced cart; the page
// stays reachable by URL so the two can be compared later.
export default function Page() {
  return <CartPage />;
}
