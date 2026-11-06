"use client";

import { useSearchParams } from "next/navigation";
import { useLayoutEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { DropdownSelect } from "@ryanmeetup/ui";
import { getColorOption, getColorPreview, getColorSlug, getColorValue, getImageColor, getListingColors } from "@/lib/product-colors";
import { getProductGallery } from "@/lib/product-gallery";
import type { ProductDesign, ReviewsData, StoreImage } from "@/lib/types";
import type { ReviewAccount } from "@/lib/review-collection";
import { ProductDetail } from "./product-detail";
import { Reviews } from "./reviews";

export function ProductGroupDetail({ title, handle, breadcrumbs, designs, defaultColor, reviewsByProduct, reviewAccount }: {
  title: string;
  breadcrumbs?: ReactNode;
  handle: string;
  designs: ProductDesign[];
  defaultColor?: string;
  reviewsByProduct: Record<string, ReviewsData>;
  reviewAccount: ReviewAccount | undefined;
}) {
  const searchParams = useSearchParams();
  const navigationFocus = useRef<string | null>(null);
  const [selectedImage, setSelectedImage] = useState<{ design: string; image: StoreImage } | null>(null);
  const gallery = useMemo(() => designs.length ? getProductGallery(designs[0].product, designs) : [], [designs]);
  const colors = useMemo(() => getListingColors(designs), [designs]);
  const selected = designs.find((design) => design.value === searchParams.get("design")) ?? designs[0];
  // The listing's default color applies only to a bare link; a chosen design keeps its own colors.
  const color = searchParams.get("color") ?? (searchParams.has("design") ? null : defaultColor ?? null);

  useLayoutEffect(() => {
    const direction = navigationFocus.current;
    if (!direction) return;
    navigationFocus.current = null;
    // Switching designs remounts ProductDetail; keep its photo control focused.
    document.querySelector<HTMLButtonElement>(`[data-photo-navigation="${direction}"]`)?.focus({ preventScroll: true });
  }, [selected?.product.id]);

  if (!selected) return null;

  function selectDesign(value: string, image?: StoreImage, colorSlug?: string) {
    navigationFocus.current = document.activeElement?.getAttribute("data-photo-navigation") ?? null;
    setSelectedImage(image ? { design: value, image } : null);
    const query = new URLSearchParams(searchParams.toString());
    query.set("design", value);
    const product = designs.find((design) => design.value === value)?.product;
    const color = product ? image ? getImageColor(product, image) : getColorValue(product, colorSlug ?? query.get("color")) : undefined;
    if (color) query.set("color", getColorSlug(color));
    else query.delete("color");
    // Next.js syncs native history with useSearchParams, including back/forward navigation.
    window.history.pushState(null, "", `/products/${handle}?${query.toString()}`);
  }

  return (
    <>
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
      <Reviews key={`reviews-${selected.product.id}`} data={reviewsByProduct[selected.product.id]} product={selected.product} reviewAccount={reviewAccount} />
    </>
  );
}
