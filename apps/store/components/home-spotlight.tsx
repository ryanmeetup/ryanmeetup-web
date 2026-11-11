import Image from "next/image";
import { Button, Card, Heading, Kicker, Text } from "@ryanmeetup/ui";
import { FiArrowRight, FiPenTool } from "react-icons/fi";
import { getProductMetaDescription } from "@/lib/metadata";
import { getListingSale } from "@/lib/money";
import { getProductDesignerCredit } from "@/lib/product-designers";
import type { HomeSpotlight as HomeSpotlightData } from "@/lib/shopify";
import { PriceBadge } from "./price-badge";
import { SaleBadge } from "./sale-badge";

/** One listing given room to breathe: a large photo, its story, and who designed it. */
export function HomeSpotlight({ spotlight: { listing, label, description: collectionCopy, curated } }: { spotlight: HomeSpotlightData }) {
  // The product's intro, not the fabric specs that follow it in Printful descriptions.
  const description = collectionCopy || getProductMetaDescription(listing);
  const href = listing.externalUrl ?? `/products/${listing.handle}`;
  const image = listing.featuredImage;
  const designer = getProductDesignerCredit(listing);
  const sale = getListingSale(listing);
  const external = listing.externalUrl ? { target: "_blank", rel: "noopener noreferrer" } : {};

  return (
    <Card size="none" className="overflow-hidden bg-white/65 dark:bg-white/5">
      <div className="grid lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
        <div className="relative aspect-square bg-black/5 lg:aspect-auto lg:min-h-[32rem] dark:bg-white/5">
          {image ? (
            <Image
              src={image.url}
              alt={image.altText || listing.title}
              fill
              sizes="(max-width: 1024px) 100vw, 55vw"
              className={`object-contain ${listing.externalUrl ? "p-10 sm:p-16" : ""}`}
            />
          ) : (
            <div aria-hidden className="grid h-full place-items-center font-cooper text-8xl text-black/10 dark:text-white/10">R</div>
          )}
          {sale.onSale && listing.availableForSale && <SaleBadge className="absolute left-4 top-4" />}
        </div>
        <div className="flex flex-col justify-center gap-6 border-t border-black/10 p-6 sm:p-10 lg:border-l lg:border-t-0 xl:p-14 dark:border-white/10">
          <div>
            <Kicker>{label}</Kicker>
            <Heading size="h2" className="mt-3 text-4xl leading-tight sm:text-5xl">{listing.title}</Heading>
            {description && <Text className="mt-4 text-lg text-black/70 dark:text-white/70">{description}</Text>}
          </div>
          {designer && (
            <p className="flex items-center gap-2 text-sm text-black/70 dark:text-white/70">
              <FiPenTool aria-hidden className="shrink-0 text-nametag" />
              <span>Designed by <span className="font-semibold text-black dark:text-white">{designer}</span></span>
            </p>
          )}
          <div className="flex flex-col items-start gap-6">
            <PriceBadge price={listing.priceRange.minVariantPrice} compareAt={sale.compareAt} from={listing.priceVaries} size="lg" />
            <Button.Link href={href} {...external} size="lg" className="!w-full sm:!w-auto" rightIcon={<FiArrowRight aria-hidden />}>
              {curated ? "Shop the drop" : "Take a closer look"}
              {listing.externalUrl && <span className="sr-only"> (opens in a new tab)</span>}
            </Button.Link>
          </div>
        </div>
      </div>
    </Card>
  );
}
