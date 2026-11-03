"use client";

import { DropdownMenu, DropdownMenuButton, DropdownMenuItem, DropdownMenuItems, IconButton, Spinner, getIconButtonClasses, toast } from "@ryanmeetup/ui";
import { useState } from "react";
import { FiPlus } from "react-icons/fi";
import { getColorOption, getVariantForColor } from "@/lib/product-colors";
import { getVariantForImage } from "@/lib/product-gallery";
import { findVariant, getSelections, isDefaultTitleOption } from "@/lib/product-options";
import type { ProductListing, ProductVariant } from "@/lib/types";
import { useCart } from "./cart-provider";

/**
 * Add to cart from a product card. The card's swatches already choose the
 * style and color, so only the remaining option — almost always size — is
 * asked for. `href` is the card's current preview link.
 */
export function QuickAdd({ product, href }: { product: ProductListing; href: string }) {
  const { addItem } = useCart();
  // Local, so adding from one card doesn't spin every card in the grid.
  const [loading, setLoading] = useState(false);
  const params = new URLSearchParams(href.split("?")[1] ?? "");
  const design = product.designs?.find((entry) => entry.value === params.get("design")) ?? product.designs?.[0];
  const target = design?.product ?? product;
  const base = getVariantForColor(target, params.get("color"))
    ?? getVariantForImage(target, target.featuredImage)
    ?? target.variants.find((variant) => variant.availableForSale) ?? target.variants[0];
  const selections = getSelections(base);
  const colorOption = getColorOption(target);
  const remaining = target.options.filter((option) => option !== colorOption && !isDefaultTitleOption(option));
  const color = colorOption && selections[colorOption.name];
  const chosen = [...new Set([(product.designs?.length ?? 0) > 1 ? design?.label : undefined, color].filter(Boolean))].join(" · ");
  const label = `Quick add ${product.title}`;
  const triggerClasses = getIconButtonClasses("md", "overlay");

  async function add(variant: ProductVariant) {
    setLoading(true);
    try {
      await addItem(target, variant, 1);
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : "Cart update failed.");
    } finally {
      setLoading(false);
    }
  }

  // More than one open choice doesn't fit a menu; the product page handles it.
  if (remaining.length > 1 || !base) {
    return (
      <IconButton.Link href={href} label={label} tooltip="Choose options" variant="overlay" size="md">
        <FiPlus aria-hidden className="h-5 w-5" />
      </IconButton.Link>
    );
  }

  if (remaining.length === 0) {
    return (
      <IconButton label={label} tooltip="Add to cart" variant="overlay" size="md" disabled={loading || !base.availableForSale} onClick={() => add(base)}>
        {loading ? <Spinner aria-hidden /> : <FiPlus aria-hidden className="h-5 w-5" />}
      </IconButton>
    );
  }

  const option = remaining[0];
  return (
    <DropdownMenu>
      <DropdownMenuButton unstyled aria-label={label} disabled={loading} className={triggerClasses}>
        {loading ? <Spinner aria-hidden /> : <FiPlus aria-hidden className="h-5 w-5" />}
      </DropdownMenuButton>
      <DropdownMenuItems className="!w-48">
        <div className="px-3 pb-1 pt-2">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-black/70 dark:text-white/70">Add to cart</p>
          {chosen && <p className="mt-0.5 truncate text-sm font-semibold">{chosen}</p>}
        </div>
        {option.values.map((value) => {
          const variant = findVariant(target, { ...selections, [option.name]: value });
          const available = Boolean(variant?.availableForSale);
          return (
            <DropdownMenuItem key={value} disabled={!available} onClick={() => variant && add(variant)} className="justify-between">
              <span>{value}</span>
              {!available && <span className="text-xs text-black/70 dark:text-white/70">Sold out</span>}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuItems>
    </DropdownMenu>
  );
}
