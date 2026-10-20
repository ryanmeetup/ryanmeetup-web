"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { Card, Tooltip } from "@ryanmeetup/ui";
import { formatMoney } from "@/lib/money";
import { getColorPreviews } from "@/lib/product-colors";
import type { ProductListing } from "@/lib/types";

const visibleSwatches = 5;

export function ProductCard({ product, eager = false }: { product: ProductListing; eager?: boolean }) {
  // A grouped listing shows its first design, so preview that design's colors.
  const colors = getColorPreviews(product.designs?.[0]?.product ?? product);
  const [selectedColor, setSelectedColor] = useState<string | null>(null);
  const color = colors.find((preview) => preview.slug === selectedColor);
  const image = color?.image ?? product.featuredImage;
  const href = `/products/${product.handle}${color ? `?color=${encodeURIComponent(color.slug)}` : ""}`;
  const hiddenColors = colors.length - visibleSwatches;

  return (
    <Card size="none" hover className="flex h-full flex-col overflow-hidden bg-white/65 dark:bg-white/5">
      <Link href={href} className="rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-black/40 dark:focus-visible:ring-white/40">
        <div className="relative aspect-square overflow-hidden bg-black/5 dark:bg-white/5">
          {image ? (
            <Image
              src={image.url}
              alt={color ? `${product.title} in ${color.value}` : image.altText || product.title}
              fill
              loading={eager ? "eager" : "lazy"}
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
              className="object-contain"
            />
          ) : (
            <div className="grid h-full place-items-center font-cooper text-5xl text-black/10 dark:text-white/10">R</div>
          )}
          {!product.availableForSale && <span className="absolute left-3 top-3 rounded-full bg-black px-3 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-white">Sold out</span>}
        </div>
        <div className="flex items-start justify-between gap-3 p-4 sm:p-5">
          <h3 className="font-cooper text-lg leading-tight tracking-wide text-black dark:text-white sm:text-xl">{product.title}</h3>
          <span className="shrink-0 text-sm font-semibold">{product.priceVaries ? "From " : ""}{formatMoney(product.priceRange.minVariantPrice)}</span>
        </div>
      </Link>
      {colors.length > 0 && (
        <div role="group" aria-label={`${product.title} colors`} className="-mt-2 flex flex-wrap items-center gap-1 px-3 pb-3 sm:-mt-3 sm:px-4 sm:pb-4">
          {colors.slice(0, visibleSwatches).map((preview) => {
            const pressed = preview.slug === color?.slug;
            return (
              <Tooltip key={preview.slug} content={preview.value} placement="bottom">
                <button
                  type="button"
                  aria-label={`Preview ${preview.value}`}
                  aria-pressed={pressed}
                  onClick={() => setSelectedColor(pressed ? null : preview.slug)}
                  className={`grid h-8 w-8 place-items-center rounded-full transition hover:bg-black/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/40 dark:hover:bg-white/10 dark:focus-visible:ring-white/40 ${pressed ? "ring-2 ring-black dark:ring-white" : ""}`}
                >
                  <span
                    aria-hidden
                    style={preview.swatch ? { backgroundColor: preview.swatch } : undefined}
                    className={`grid h-5 w-5 place-items-center rounded-full border border-black/20 text-[9px] font-bold uppercase text-black/70 dark:border-white/40 dark:text-white/70 ${preview.swatch ? "" : "bg-black/5 dark:bg-white/10"}`}
                  >
                    {preview.swatch ? null : preview.value.charAt(0)}
                  </span>
                </button>
              </Tooltip>
            );
          })}
          {hiddenColors > 0 && (
            <Link href={`/products/${product.handle}`} className="rounded-sm px-1 text-xs font-semibold text-black/70 hover:text-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/40 dark:text-white/70 dark:hover:text-white dark:focus-visible:ring-white/40">
              +{hiddenColors}<span className="sr-only"> more colors</span>
            </Link>
          )}
          <span className="sr-only" aria-live="polite">{color ? `Showing ${color.value}` : ""}</span>
        </div>
      )}
    </Card>
  );
}
