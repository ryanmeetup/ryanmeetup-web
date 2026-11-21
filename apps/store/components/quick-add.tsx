"use client";

import { DropdownPanel, DropdownPanelButton, DropdownPanelContent, DropdownSelect, IconButton, Spinner, getIconButtonClasses, toast, type DropdownSelectOption } from "@ryanmeetup/ui";
import { useState } from "react";
import { FiPlus } from "react-icons/fi";
import { getColorOption, getColorPreview, getColorSlug, getKnownSwatch, getListingColors, getVariantForColor } from "@/lib/product-colors";
import { getVariantForImage } from "@/lib/product-gallery";
import { findVariant, getSelections, isDefaultTitleOption } from "@/lib/product-options";
import type { Product, ProductListing, ProductVariant } from "@/lib/types";
import { cartUnavailableMessage } from "@/lib/cart-action";
import { useCart } from "./cart-provider";

const labelClasses = "text-xs font-semibold uppercase tracking-caps-tight text-black/70 dark:text-white/70";
const choiceClasses = "flex items-center justify-center rounded-lg border border-black/10 px-1 py-2 text-sm font-semibold transition hover:bg-black/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/30 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent dark:border-white/10 dark:hover:bg-white/10 dark:focus-visible:ring-white/30";

function getSwatch(product: Pick<Product, "options" | "variants">, color: string) {
  return getColorPreview(product, getColorSlug(color))?.swatch ?? getKnownSwatch(color) ?? undefined;
}

/**
 * Add to cart from a product card. It opens on the card's previewed design
 * and color — `href` is the card's current preview link — and both can be
 * changed before picking the remaining option, almost always size.
 */
export function QuickAdd({ product, href }: { product: ProductListing; href: string }) {
  const { addItem } = useCart();
  // Local, so adding from one card doesn't spin every card in the grid.
  const [loading, setLoading] = useState(false);
  const params = new URLSearchParams(href.split("?")[1] ?? "");
  const [designValue, setDesignValue] = useState(params.get("design"));
  const [colorSlug, setColorSlug] = useState(params.get("color") ?? (params.has("design") ? null : product.defaultColor ?? null));
  const designs = product.designs ?? [];
  const design = designs.find((entry) => entry.value === designValue) ?? designs[0];
  const target = design?.product ?? product;
  const base = getVariantForColor(target, colorSlug)
    ?? getVariantForImage(target, target.featuredImage)
    ?? target.variants.find((variant) => variant.availableForSale) ?? target.variants[0];
  const selections = getSelections(base);
  const colorOption = getColorOption(target);
  const remaining = target.options.filter((option) => option !== colorOption && !isDefaultTitleOption(option));
  // Members of a colors-only listing are colors, not designs; a size-only
  // member like "I Heart RY Shirt - Black" names its color in its title.
  const listingColors = designs.length ? getListingColors(designs) : undefined;
  const color = (colorOption && selections[colorOption.name]) || (listingColors ? design?.label : undefined);
  const currentColorSlug = color ? getColorSlug(color) : "";

  const designOptions: DropdownSelectOption[] = !listingColors && designs.length > 1
    ? designs.map((entry) => ({ label: entry.product.availableForSale ? entry.label : `${entry.label} — sold out`, value: entry.value }))
    : [];
  const colorOptions: DropdownSelectOption[] = listingColors
    ? listingColors.map((entry) => ({
      label: entry.available ? entry.color : `${entry.color} — sold out`,
      value: entry.slug,
      color: getSwatch(designs.find((member) => member.value === entry.design)?.product ?? target, entry.color),
    }))
    : colorOption && colorOption.values.length > 1
      ? colorOption.values.map((value) => {
        const available = target.variants.some((variant) => variant.availableForSale && variant.selectedOptions.some((selected) => selected.name === colorOption.name && selected.value === value));
        return { label: available ? value : `${value} — sold out`, value: getColorSlug(value), color: getSwatch(target, value) };
      })
      : [];

  function chooseColor(slug: string) {
    const listed = listingColors?.find((entry) => entry.slug === slug);
    if (listed) setDesignValue(listed.design);
    setColorSlug(slug);
  }

  const label = `Quick add ${product.title}`;
  const editable = designOptions.length > 0 || colorOptions.length > 0;

  async function add(variant: ProductVariant, close?: () => void) {
    setLoading(true);
    try {
      await addItem(target, variant, 1);
      close?.();
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : cartUnavailableMessage);
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

  // Nothing to choose: one click adds it.
  if (remaining.length === 0 && !editable) {
    return (
      <IconButton label={label} tooltip="Add to cart" variant="overlay" size="md" disabled={loading || !base.availableForSale} onClick={() => add(base)}>
        {loading ? <Spinner aria-hidden /> : <FiPlus aria-hidden className="h-5 w-5" />}
      </IconButton>
    );
  }

  const option = remaining[0];
  return (
    <DropdownPanel>
      <DropdownPanelButton aria-label={label} disabled={loading} className={getIconButtonClasses("md", "overlay")}>
        {loading ? <Spinner aria-hidden /> : <FiPlus aria-hidden className="h-5 w-5" />}
      </DropdownPanelButton>
      <DropdownPanelContent role="dialog" aria-label={label} className="!w-64">
        {({ close }) => (
          <>
            {/* Gap, not space-y: a compact DropdownSelect renders as `display: contents`. */}
            <div className="flex flex-col gap-2 pb-1 pt-1.5">
              <p className={`px-2 ${labelClasses}`}>Add to cart</p>
              {designOptions.length > 0 && (
                <DropdownSelect label="Design" options={designOptions} value={design?.value ?? ""} onChange={setDesignValue} className="w-full" />
              )}
              {colorOptions.length > 0 ? (
                <DropdownSelect label="Color" options={colorOptions} value={currentColorSlug} onChange={chooseColor} className="w-full" />
              ) : color && (
                <p className="flex min-w-0 items-center gap-1.5 px-2 text-sm">
                  <span className="text-black/70 dark:text-white/70">Color</span>
                  <span aria-hidden style={{ backgroundColor: getSwatch(target, color) }} className="ml-1.5 h-3 w-3 shrink-0 rounded-full border border-black/20 dark:border-white/40" />
                  <span className="truncate font-semibold">{color}</span>
                </p>
              )}
            </div>
            <div role="separator" className="my-1 border-t border-black/10 dark:border-white/10" />
            {option ? (
              <div role="group" aria-label={option.name} className="flex flex-col gap-2">
                <p aria-hidden className={`px-2 pt-1 ${labelClasses}`}>{option.name}</p>
                <div className="grid grid-cols-4 gap-1">
                  {option.values.map((value) => {
                    const variant = findVariant(target, { ...selections, [option.name]: value });
                    const available = Boolean(variant?.availableForSale);
                    return (
                      <button key={value} type="button" disabled={!available || loading} onClick={() => variant && add(variant, close)} className={choiceClasses}>
                        <span className={available ? undefined : "line-through"}>{value}</span>
                        {!available && <span className="sr-only">, sold out</span>}
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : (
              <button type="button" disabled={loading || !base.availableForSale} onClick={() => add(base, close)} className={choiceClasses}>
                {base.availableForSale ? "Add to cart" : "Sold out"}
              </button>
            )}
          </>
        )}
      </DropdownPanelContent>
    </DropdownPanel>
  );
}
