"use client";

import Image from "next/image";
import { trackStoreEvent } from "@/lib/analytics";
import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { RatingStars, Tooltip } from "@ryanmeetup/ui";
import { getListingSale } from "@/lib/money";
import { getListingColorPreviews } from "@/lib/product-colors";
import { withProductOrigin } from "@/lib/product-origin";
import type { ListingRating, ProductListing } from "@/lib/types";
import { MediaCard } from "./media-card";
import { PriceBadge } from "./price-badge";
import { QuickAdd } from "./quick-add";
import { SaleBadge } from "./sale-badge";

// A swatch button is h-8 w-8 beside a gap-1; the "+N" link takes about one slot.
const swatchSlot = 32;
const swatchGap = 4;
// Until the row is measured, show this many; the row never wraps, so extras clip rather than drop a line.
const initialSwatches = 5;

/** How many slots of a single swatch row fit in `width`. */
function countSlots(width: number) {
  return Math.max(1, Math.floor((width + swatchGap) / (swatchSlot + swatchGap)));
}

/** Stars, average, and count on one line; spoken once as a sentence rather than piece by piece. */
function CardRating({ rating }: { rating: ListingRating }) {
  const average = rating.average.toFixed(1);
  return (
    <p className="flex items-center gap-1.5 text-xs font-semibold tabular-nums text-black/70 sm:text-sm dark:text-white/70">
      <span aria-hidden className="flex items-center gap-1.5">
        <RatingStars rating={Number(average)} className="text-sm sm:text-base" />
        {average}
        <span className="font-normal">({rating.count})</span>
      </span>
      <span className="sr-only">Rated {average} out of 5 from {rating.count} reviews</span>
    </p>
  );
}

/** `from` is the collection the card is listed on, named in the product page's breadcrumb. */
export function ProductCard({ product, eager = false, from }: { product: ProductListing; eager?: boolean; from?: string }) {
  const colors = getListingColorPreviews(product);
  const swatchRow = useRef<HTMLDivElement>(null);
  const [slots, setSlots] = useState<number | null>(null);
  useEffect(() => {
    const row = swatchRow.current;
    if (!row) return;
    const observer = new ResizeObserver(([entry]) => setSlots(countSlots(entry.contentRect.width)));
    observer.observe(row);
    return () => observer.disconnect();
  }, []);
  const candidates = colors.filter((preview) => preview.swatch && preview.image);
  const capacity = slots ?? initialSwatches;
  // Keep one slot for "+N" whenever anything is left out of the row.
  const swatches = candidates.slice(0, colors.length > capacity ? capacity - 1 : capacity);
  const [selectedColor, setSelectedColor] = useState<string | null>(null);
  const color = colors.find((preview) => preview.href === selectedColor);
  const image = color?.image ?? product.featuredImage;
  const href = product.externalUrl ?? withProductOrigin(color?.href ?? `/products/${product.handle}`, from);
  const hiddenColors = colors.length - swatches.length;
  const sale = getListingSale(product);
  const priceId = useId();

  return (
    <MediaCard
      href={href}
      linkProps={{ "aria-describedby": priceId, ...{ "data-analytics-product": product.handle }, ...(product.externalUrl && { target: "_blank", rel: "noopener noreferrer" }) }}
      media={image ? (
        <Image
          src={image.url}
          alt={color ? `${product.title} in ${color.label ?? color.value}` : image.altText || product.title}
          fill
          loading={eager ? "eager" : "lazy"}
          sizes="(max-width: 1024px) 50vw, 33vw"
          // Off-Shopify images are cutouts rather than framed mockups, so give them room.
          className={`object-contain ${product.externalUrl ? "p-5 sm:p-10" : ""}`}
        />
      ) : (
        <div className="grid h-full place-items-center font-cooper text-5xl text-black/10 dark:text-white/10">R</div>
      )}
      badges={product.availableForSale ? <SaleBadge markedDown={sale.onSale} promotable={!product.externalUrl} className="absolute left-3 top-3" /> : <span className="absolute left-3 top-3 rounded-full bg-black px-3 py-1 text-[10px] font-bold uppercase tracking-caps-tight text-white">Sold out</span>}
      // The currency action is a sibling of the link, so switching never opens the product.
      mediaOverlay={
        <PriceBadge
          id={priceId}
          price={product.priceRange.minVariantPrice}
          compareAt={sale.compareAt}
          promotable={!product.externalUrl}
          from={product.priceVaries}
          className="absolute bottom-3 left-3 max-w-[calc(100%-1.5rem)]"
        />
      }
      title={<>{product.title}{product.externalUrl && <span className="sr-only"> (opens in a new tab)</span>}</>}
      after={<>
      {/* One row only; padding inside the clip keeps focus and pressed rings visible. */}
      {colors.length > 0 && (
        <div ref={swatchRow} role="group" aria-label={`${product.title} colors`} className="mx-2.5 -mt-2.5 mb-2.5 flex flex-nowrap items-center gap-1 overflow-hidden p-0.5 sm:mx-3.5 sm:-mt-3.5 sm:mb-3.5">
          {swatches.map((preview) => {
            const pressed = preview.href === color?.href;
            return (
              <Tooltip key={preview.href} content={preview.label ?? preview.value} placement="bottom">
                <button
                  type="button"
                  aria-label={`Preview ${preview.label ?? preview.value}`}
                  aria-pressed={pressed}
                  onClick={() => { setSelectedColor(pressed ? null : preview.href); trackStoreEvent("card_color_previewed", { product: product.handle, color: pressed ? "default" : preview.label ?? preview.value }); }}
                  className={`grid h-8 w-8 shrink-0 place-items-center rounded-full transition hover:bg-black/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/40 dark:hover:bg-white/10 dark:focus-visible:ring-white/40 ${pressed ? "ring-2 ring-black dark:ring-white" : ""}`}
                >
                  <span
                    aria-hidden
                    style={{ backgroundColor: preview.swatch ?? undefined }}
                    className="block h-5 w-5 rounded-full border border-black/20 dark:border-white/40"
                  />
                </button>
              </Tooltip>
            );
          })}
          {hiddenColors > 0 && (
            <Link href={withProductOrigin(`/products/${product.handle}`, from)} className="shrink-0 rounded-sm px-1 text-xs font-semibold text-black/70 hover:text-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/40 dark:text-white/70 dark:hover:text-white dark:focus-visible:ring-white/40">
              +{hiddenColors}<span className="sr-only"> more colors</span>
            </Link>
          )}
          <span className="sr-only" aria-live="polite">{color ? `Showing ${color.label ?? color.value}` : ""}</span>
        </div>
      )}
      {product.availableForSale && !product.externalUrl && (
        // A sibling of the card link, not inside it, so it stays its own control.
        <div className="absolute right-3 top-3">
          {/* Keyed by the preview, so choosing a swatch resets its picks. */}
          <QuickAdd key={href} product={product} href={href} />
        </div>
      )}
      </>}
    >
      {product.rating && <CardRating rating={product.rating} />}
    </MediaCard>
  );
}
