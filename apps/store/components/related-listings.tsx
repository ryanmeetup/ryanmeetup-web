import { Button, EmptyState, SectionHeader } from "@ryanmeetup/ui";
import { FiArrowRight } from "react-icons/fi";
import { withListingRatings } from "@/lib/listing-ratings";
import { getRelatedBrowseLink } from "@/lib/related-listings";
import { getRelatedListings } from "@/lib/shopify";
import type { ProductListing } from "@/lib/types";
import { ProductGrid } from "./product-grid";

/**
 * Other listings to shop from a product page. Streams in after the product
 * itself, and steps aside quietly if the catalog can't be read, since the
 * product above is what the shopper came for.
 */
export async function RelatedListings({ product }: { product: ProductListing }) {
  let related: ProductListing[];
  try {
    related = (await withListingRatings({ products: await getRelatedListings(product) })).products;
  } catch (error) {
    console.error("Could not load related listings", error);
    return null;
  }
  const browse = getRelatedBrowseLink(product, related);

  return (
    <section aria-labelledby="related-listings" className="border-t border-black/10 py-16 dark:border-white/10 sm:py-20">
      <SectionHeader
        align="left"
        title={<span id="related-listings">More from this shop</span>}
        actions={(
          <Button.Link href={browse.href} size="md" variant="secondary" className="!w-full sm:!w-auto" rightIcon={<FiArrowRight aria-hidden />}>
            {browse.label}
          </Button.Link>
        )}
      />
      {related.length ? (
        <ProductGrid products={related} eagerCount={0} evenRows className="mt-8" />
      ) : (
        <EmptyState className="mt-8" message="Nothing else on this shelf yet" />
      )}
    </section>
  );
}
