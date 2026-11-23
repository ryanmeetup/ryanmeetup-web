import { Button, SectionHeader } from "@ryanmeetup/ui";
import type { Metadata } from "next";
import { Suspense } from "react";
import { FiArrowRight } from "react-icons/fi";
import { JsonLd } from "@/components/json-ld";
import { HomeCollectionTiles } from "@/components/home-collection-tiles";
import { HomeHero } from "@/components/home-hero";
import { HomeSpotlight } from "@/components/home-spotlight";
import { HomeReviews } from "@/components/home-reviews";
import { ProductGrid } from "@/components/product-grid";
import { ShippingExpectations } from "@/components/shipping-expectations";
import { SupportNote } from "@/components/support-note";
import { withListingRatings } from "@/lib/listing-ratings";
import { buildPageMetadata, DEFAULT_IMAGE, SITE_DESCRIPTION, SITE_NAME } from "@/lib/metadata";
import { getShippingExpectations } from "@/lib/product-guidance";
import { favoritesPhoneLimit, getHomeCatalog, getPolicies, getShippingCountries } from "@/lib/shopify";
import { buildStoreSchema } from "@/lib/structured-data";

export const revalidate = 300;

export const metadata = {
  ...buildPageMetadata({ title: SITE_NAME, description: SITE_DESCRIPTION, canonical: "/", image: DEFAULT_IMAGE }),
  // The store name alone, not "Ryan Meetup Store | Ryan Meetup Store".
  title: { absolute: SITE_NAME },
} satisfies Metadata;

export default async function HomePage() {
  const [{ spotlight, favorites: shelf, collections }, shippingCountries, policies] = await Promise.all([
    getHomeCatalog(),
    // The return policy and the shipping strip's country count are never a reason to fail the home page.
    getShippingCountries().catch((error: unknown) => {
      console.error("Could not load shipping countries for the home page.", error);
      return [];
    }),
    // Without the policy, the shipping strip says only what is always true: everything is made to order.
    getPolicies().catch((error: unknown) => {
      console.error("Could not load policies for the home shipping strip.", error);
      return [];
    }),
  ]);
  const shipping = getShippingExpectations(policies, shippingCountries);
  const favorites = await withListingRatings(shelf);
  return (
    <main className="flex flex-col gap-8 pb-6 sm:gap-12 sm:pb-8 lg:pb-10">
      <JsonLd data={buildStoreSchema(shippingCountries)} />
      <HomeHero />

      {favorites.products.length > 0 && (
        <section data-analytics-placement="home_favorites" data-analytics-section="home_favorites" aria-labelledby="home-favorites" className="store-container">
          <SectionHeader
            align="left"
            title={<span id="home-favorites">{favorites.collection.title}</span>}
            description={favorites.collection.description}
            // Phones show fewer cards than desktop, so they offer the full catalog sooner.
            actions={favorites.total > Math.min(favorites.products.length, favoritesPhoneLimit) && (
              <Button.Link href="/collections/all" size="md" variant="secondary" className="!w-full sm:!w-auto" rightIcon={<FiArrowRight />}>
                See everything
              </Button.Link>
            )}
          />
          <ProductGrid products={favorites.products} eagerCount={0} evenRows phoneLimit={favoritesPhoneLimit} className="mt-8" />
        </section>
      )}

      <section data-analytics-placement="home_support" data-analytics-section="home_support" aria-label="Support Ryan Meetup" className="store-container">
        <SupportNote />
      </section>

      <section data-analytics-placement="home_shipping" data-analytics-section="home_shipping" aria-label="Shipping and production" className="store-container">
        <ShippingExpectations items={shipping} />
      </section>

      {spotlight && (
        <section data-analytics-placement="home_spotlight" data-analytics-section="home_spotlight" aria-label={spotlight.label} className="store-container">
          <HomeSpotlight spotlight={spotlight} />
        </section>
      )}

      {collections.length > 0 && (
        <section data-analytics-placement="home_collections" data-analytics-section="home_collections" id="collections" aria-labelledby="home-collections" className="store-container scroll-mt-24">
          <SectionHeader
            align="left"
            title={<span id="home-collections">Shop by collection</span>}
            actions={
              <Button.Link href="/collections/all" size="md" variant="secondary" className="!w-full sm:!w-auto" rightIcon={<FiArrowRight />}>
                See everything
              </Button.Link>
            }
          />
          <HomeCollectionTiles tiles={collections} className="mt-8" />
        </section>
      )}
      <Suspense fallback={null}><HomeReviews /></Suspense>
    </main>
  );
}
