"use client";

import { useSearchParams } from "next/navigation";
import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { DropdownSelect } from "@ryanmeetup/ui";
import { getColorPreview } from "@/lib/product-colors";
import { getProductGallery } from "@/lib/product-gallery";
import type { ProductDesign, ReviewsData, StoreImage } from "@/lib/types";
import { ProductDetail } from "./product-detail";
import { Reviews } from "./reviews";

export function ProductGroupDetail({ title, handle, designs, reviewsByProduct }: {
  title: string;
  handle: string;
  designs: ProductDesign[];
  reviewsByProduct: Record<string, ReviewsData>;
}) {
  const searchParams = useSearchParams();
  const navigationFocus = useRef<string | null>(null);
  const [selectedImage, setSelectedImage] = useState<{ design: string; image: StoreImage } | null>(null);
  const gallery = useMemo(() => designs.length ? getProductGallery(designs[0].product, designs) : [], [designs]);
  const selected = designs.find((design) => design.value === searchParams.get("design")) ?? designs[0];

  useLayoutEffect(() => {
    const direction = navigationFocus.current;
    if (!direction) return;
    navigationFocus.current = null;
    // Switching designs remounts ProductDetail; keep its photo control focused.
    document.querySelector<HTMLButtonElement>(`[data-photo-navigation="${direction}"]`)?.focus({ preventScroll: true });
  }, [selected?.product.id]);

  if (!selected) return null;

  function selectDesign(value: string, image?: StoreImage) {
    navigationFocus.current = document.activeElement?.getAttribute("data-photo-navigation") ?? null;
    setSelectedImage(image ? { design: value, image } : null);
    const query = new URLSearchParams(searchParams.toString());
    query.set("design", value);
    // Next.js syncs native history with useSearchParams, including back/forward navigation.
    window.history.pushState(null, "", `/products/${handle}?${query.toString()}`);
  }

  return (
    <>
      <ProductDetail
        key={`product-${selected.product.id}`}
        product={selected.product}
        title={title}
        gallery={gallery}
        initialImage={selectedImage?.design === selected.value ? selectedImage.image : getColorPreview(selected.product, searchParams.get("color"))?.image}
        onSelectGalleryImage={(entry) => {
          if (entry.design) selectDesign(entry.design, entry.image);
        }}
        designField={
          <DropdownSelect
            label="Nametag design"
            variant="field"
            required
            value={selected.value}
            onChange={selectDesign}
            options={designs.map((design) => ({
              label: design.product.availableForSale ? design.label : `${design.label} — sold out`,
              value: design.value,
            }))}
          />
        }
      />
      <Reviews key={`reviews-${selected.product.id}`} data={reviewsByProduct[selected.product.id]} productId={selected.product.id} />
    </>
  );
}
