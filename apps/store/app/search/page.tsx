import type { Metadata } from "next";
import { Breadcrumbs, SectionHeader } from "@ryanmeetup/ui";
import { FiSearch } from "react-icons/fi";
import { ProductSearch } from "@/components/product-search";
import { StoreHomeIcon } from "@/lib/navigation";
import { getCollection } from "@/lib/shopify";

export const metadata: Metadata = {
  title: "Search",
  description: "Search the Ryan Meetup Store for shirts, hats, and other Ryan provisions.",
  // Result pages repeat the catalog, so only the products themselves get indexed.
  robots: { index: false, follow: true },
};

export default async function SearchPage() {
  // The whole catalog is small and already cached for Shop all, so results filter in
  // the browser as the shopper types instead of asking Shopify on every keystroke.
  const listings = (await getCollection("all"))?.products ?? [];
  return (
    <main className="store-container py-10 sm:py-14">
      <Breadcrumbs variant="compact" crumbs={[{ href: "/", title: "Store", icon: <StoreHomeIcon aria-hidden className="shrink-0" /> }, { href: "/search", title: "Search", current: true, icon: <FiSearch aria-hidden className="shrink-0" /> }]} />
      <SectionHeader className="mt-8" headingLevel="h1" title="Search the store" headingClassName="text-4xl sm:text-6xl" />
      <div className="mt-8"><ProductSearch listings={listings} /></div>
    </main>
  );
}
