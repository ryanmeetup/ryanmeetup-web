"use client";

import { useSearchParams } from "next/navigation";
import { trackStoreEvent } from "@/lib/analytics";
import { useLayoutEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { DropdownSelect } from "@ryanmeetup/ui";
import { getColorOption, getColorPreview, getColorSlug, getColorValue, getImageColor, getListingColors } from "@/lib/product-colors";
import { getProductGallery } from "@/lib/product-gallery";
import type { ProductDesign, ReviewsData, StoreImage } from "@/lib/types";
import type { CustomReviewAccess } from "@/lib/custom-review-access";
import { ProductDetail } from "./product-detail";
import { ProductSchema } from "./product-schema";
import { Reviews } from "./reviews";

export function ProductGroupDetail({ title, handle, url, breadcrumbs, designs, defaultColor, reviewsByProduct, reviewAccessByProduct }: {
  title: string;
  url: string;
  breadcrumbs?: ReactNode;
  handle: string;
  designs: ProductDesign[];
  defaultColor?: string;
  reviewsByProduct: Record<string, ReviewsData>;
  reviewAccessByProduct: Record<string, CustomReviewAccess>;
}) {
  const searchParams = useSearchParams();
  const navigationFocus = useRef<string | null>(null);
  const [selectedImage, setSelectedImage] = useState<{ design: string; image: StoreImage } | null>(null);
  const gallery = useMemo(() => designs.length ? getProductGallery(designs[0].product, designs) : [], [designs]);
  const colors = useMemo(() => getListingColors(designs), [designs]);
  // The listing's default color applies only to a bare link; a chosen design keeps its own colors.
  const color = searchParams.get("color") ?? (searchParams.has("design") ? null : defaultColor ?? null);
  // Which product prints a color is a printing detail, so a color-split listing's URL names only the color.
  const colorDesign = colors && color ? colors.find((entry) => entry.slug === getColorSlug(color))?.design : undefined;
  const selected = designs.find((design) => design.value === (colorDesign ?? searchParams.get("design"))) ?? designs[0];

  useLayoutEffect(() => {
    const direction = navigationFocus.current;
    if (!direction) return;
    navigationFocus.current = null;
    // Switching designs remounts ProductDetail; keep its photo control focused.
    document.querySelector<HTMLButtonElement>(`[data-photo-navigation="${direction}"]`)?.focus({ preventScroll: true });
  }, [selected?.product.id]);

  if (!selected) return null;

  function selectDesign(value: string, image?: StoreImage, colorSlug?: string) {
    trackStoreEvent("product_design_changed", { product: handle, design: colorSlug ?? value });
    navigationFocus.current = document.activeElement?.getAttribute("data-photo-navigation") ?? null;
    setSelectedImage(image ? { design: value, image } : null);
    const query = new URLSearchParams(searchParams.toString());
    const product = designs.find((design) => design.value === value)?.product;
    const color = product ? image ? getImageColor(product, image) : getColorValue(product, colorSlug ?? query.get("color")) : undefined;
    const slug = color ? getColorSlug(color) : colors?.find((entry) => entry.design === value)?.slug;
    if (colors && slug) query.delete("design");
    else query.set("design", value);
    if (slug) query.set("color", slug);
    else query.delete("color");
    // Next.js syncs native history with useSearchParams, including back/forward navigation.
    window.history.pushState(null, "", `/products/${handle}?${query.toString()}`);
  }

  return (
    <>
      <ProductSchema product={selected.product} title={title} reviews={reviewsByProduct[selected.product.id]} url={`${url}?${new URLSearchParams(colors ? { color: colorDesign && color ? getColorSlug(color) : colors.find((entry) => entry.design === selected.value)?.slug ?? "" } : { design: selected.value })}`} />
      <ProductDetail
        key={`product-${selected.product.id}`}
        product={selected.product}
        title={title}
        breadcrumbs={breadcrumbs}
        gallery={gallery}
        initialColor={color}
        initialImage={selectedImage?.design === selected.value ? selectedImage.image : getColorPreview(selected.product, color)?.image}
        onSelectGalleryImage={(entry) => {
          if (entry.design) selectDesign(entry.design, entry.image);
        }}
        hideColorOption={Boolean(colors)}
        designField={({ selections, selectOption }) => {
          if (!colors) {
            return (
              <DropdownSelect
                label="Style"
                variant="field"
                required
                value={selected.value}
                onChange={(value) => selectDesign(value)}
                options={designs.map((design) => ({
                  label: design.product.availableForSale ? design.label : `${design.label} — sold out`,
                  value: design.value,
                }))}
              />
            );
          }
          // Which Shopify product supplies a color is a printing detail; shoppers just pick the color.
          const colorOption = getColorOption(selected.product);
          const current = colorOption && selections[colorOption.name];
          const own = colors.filter(({ design }) => design === selected.value);
          return (
            <DropdownSelect
              label="Color"
              variant="field"
              required
              value={(own.find(({ color }) => color === current) ?? own[0])?.slug ?? ""}
              onChange={(slug) => {
                const choice = colors.find((entry) => entry.slug === slug);
                if (!choice) return;
                // Another color of this product keeps the shopper's size; another product remounts.
                if (choice.design === selected.value && colorOption) selectOption(colorOption.name, choice.color);
                else selectDesign(choice.design, undefined, slug);
              }}
              options={colors.map(({ color, slug, available }) => ({ label: available ? color : `${color} — sold out`, value: slug }))}
            />
          );
        }}
      />
      <Reviews key={`reviews-${selected.product.id}`} data={reviewsByProduct[selected.product.id]} product={selected.product} access={reviewAccessByProduct[selected.product.id]} />
    </>
  );
}
