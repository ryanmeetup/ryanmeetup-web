import {
  Button,
  Heading,
  RotatingGallery,
  SectionHeader,
  Text,
} from "@ryanmeetup/ui";
import type { RotatingGalleryItem } from "@ryanmeetup/ui";
import type { Metadata } from "next";
import Image from "next/image";
import { Suspense } from "react";
import { FiArrowRight } from "react-icons/fi";
import { JsonLd } from "@/components/json-ld";
import { HomeCollectionTiles } from "@/components/home-collection-tiles";
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

// Portraits pair up side by side so two of them fill the landscape frame. An
// unpaired portrait shows whole over a blurred fill until it gets a partner.
const HERO_PHOTOS: RotatingGalleryItem[] = [
  {
    src: "/hero/ryan-merch-booth.jpg",
    alt: "Ryan Meetup shirts hanging above a merch table, with a volunteer in a Ryan’s Father tee",
    objectPosition: "35% 50%",
  },
  {
    src: "/hero/ryan-super-tee.jpg",
    alt: "A Ryan tearing open a dress shirt to reveal a superhero-style R logo tee",
    objectPosition: "50% 40%",
    pairedWith: {
      src: "/hero/ryan-name-tag-tee.jpg",
      alt: "A Ryan in a Ryans beanie and a white tee with a Hello my name is Ryan name tag",
      objectPosition: "50% 40%",
    },
  },
  {
    src: "/hero/ryan-hammock-crewneck.jpg",
    alt: "A Ryan in red heart sunglasses lounging in a hammock in a Ryan Meetup crewneck, phone in one hand and cash in the other",
    objectPosition: "65% 50%",
  },
  {
    src: "/hero/ryan-family-merch-table.jpg",
    alt: "Three volunteers in Ryan’s Mother, Ryan’s Sister, and Ryan’s Father tees behind a table of Ryan Meetup shirts and hats",
  },
  {
    src: "/hero/ryan-philadelphia-tee.jpg",
    alt: "A Ryan in mirrored sunglasses showing off an It’s Always Ryan in Philadelphia tee",
  },
];

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
    <main className="flex flex-col gap-8 py-6 sm:gap-12 sm:py-8 lg:py-10">
      <JsonLd data={buildStoreSchema(shippingCountries)} />
      <section data-analytics-placement="home_hero" data-analytics-section="home_hero" aria-label="Ryan Meetup merch" className="store-container">
        <div className="overflow-hidden rounded-3xl bg-white/65 shadow-drop dark:bg-white/5">
          <div className="grid items-start gap-4 p-4 sm:gap-8 sm:p-8 lg:grid-cols-2 lg:gap-10 xl:gap-12 xl:p-10">
            <div className="relative min-w-0 text-left">
              <Image
                src="/hero/ryan-name-tag.png"
                alt=""
                width={2264}
                height={1442}
                sizes="(min-width: 640px) 80px, 48px"
                className="pointer-events-none mb-4 ml-1 h-auto w-12 -rotate-6 select-none sm:mb-5 sm:w-20"
              />
              <Heading
                size="h1"
                className="text-[clamp(1.5rem,7.5vw,1.875rem)] leading-tight sm:text-5xl lg:text-3xl xl:text-5xl"
              >
                <span className="block">Merch with your{" "}</span>
                <span className="block">name on it.</span>
              </Heading>
              <Text className="mt-3 max-w-md text-base sm:mt-4 sm:text-lg">
                Shirts, hats, and everyday goods for the world’s most organized
                first name.
              </Text>
              <div className="mt-4 flex flex-col items-start gap-3 sm:mt-6 sm:flex-row sm:flex-wrap sm:items-center">
                <Button.Link
                  href="/collections/all"
                  size="lg"
                  className="!w-full sm:!w-auto"
                  rightIcon={<FiArrowRight aria-hidden />}
                >
                  Shop all merch
                </Button.Link>
                <Button.Link
                  href="#collections"
                  size="lg"
                  variant="link"
                >
                  Browse collections
                </Button.Link>
              </div>
            </div>
            <RotatingGallery
              items={HERO_PHOTOS}
              preload
              sizes="(min-width: 1536px) calc((100vw - 576px) / 2), (min-width: 1280px) calc((100vw - 384px) / 2), (min-width: 1024px) calc((100vw - 360px) / 2), (min-width: 640px) calc(100vw - 96px), calc(100vw - 64px)"
              className="aspect-video sm:aspect-[3/2] lg:aspect-auto lg:h-full lg:min-h-80"
            />
          </div>
        </div>
      </section>

      <section data-analytics-placement="home_support" data-analytics-section="home_support" aria-label="Support Ryan Meetup" className="store-container">
        <SupportNote />
      </section>

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
