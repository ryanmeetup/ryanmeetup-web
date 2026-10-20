"use client";

import Image from "next/image";
import { useEffect, useEffectEvent, useId, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Button, DropdownSelect, ErrorCallout, FormStatus, IconButton, Kicker } from "@ryanmeetup/ui";
import { FiCheck, FiCheckCircle, FiChevronLeft, FiChevronRight, FiPackage, FiShield, FiShoppingBag } from "react-icons/fi";
import { formatMoney } from "@/lib/money";
import { getProductGallery, getVariantForImage, groupProductGallery } from "@/lib/product-gallery";
import type { ProductGalleryImage } from "@/lib/product-gallery";
import type { Product, StoreImage } from "@/lib/types";
import { useCart } from "./cart-provider";
import { ProductDescription } from "./product-description";

export function ProductDetail({ product, title = product.title, designField, gallery, initialImage, onSelectGalleryImage }: {
  product: Product;
  title?: string;
  designField?: ReactNode;
  gallery?: ProductGalleryImage[];
  initialImage?: StoreImage;
  onSelectGalleryImage?: (image: ProductGalleryImage) => void;
}) {
  const router = useRouter();
  const { addItem, error, loading } = useCart();
  const initialVariant = getVariantForImage(product, initialImage ?? product.featuredImage)
    ?? product.variants.find((variant) => variant.availableForSale) ?? product.variants[0];
  const [selections, setSelections] = useState<Record<string, string>>(
    Object.fromEntries(initialVariant?.selectedOptions.map((option) => [option.name, option.value]) ?? []),
  );
  const [quantity, setQuantity] = useState("1");
  const [added, setAdded] = useState(false);
  const [activeImage, setActiveImage] = useState(initialImage ?? initialVariant?.image ?? product.featuredImage ?? product.images[0] ?? null);
  const galleryImages = gallery ?? getProductGallery(product);
  const galleryGroups = groupProductGallery(galleryImages);
  const galleryRef = useRef<HTMLDivElement>(null);
  const thumbnailsRef = useRef<HTMLDivElement>(null);
  const galleryHintId = useId();
  const hasMultipleImages = galleryImages.length > 1;
  const activeImageIndex = Math.max(0, galleryImages.findIndex((entry) => entry.productId === product.id && entry.image.url === activeImage?.url));
  const variant = useMemo(
    () =>
      product.variants.find((item) =>
        item.selectedOptions.every((option) => selections[option.name] === option.value),
      ),
    [product.variants, selections],
  );

  function selectOption(name: string, value: string) {
    const nextSelections = { ...selections, [name]: value };
    setSelections(nextSelections);
    const nextVariant = product.variants.find((item) => item.selectedOptions.every((option) => nextSelections[option.name] === option.value));
    if (nextVariant?.image) setActiveImage(nextVariant.image);
    setAdded(false);
  }

  function selectGalleryImage(entry: ProductGalleryImage) {
    if (entry.productId !== product.id) {
      onSelectGalleryImage?.(entry);
      return;
    }
    setActiveImage(entry.image);
    const imageVariant = getVariantForImage(product, entry.image, selections);
    if (imageVariant) setSelections(Object.fromEntries(imageVariant.selectedOptions.map((option) => [option.name, option.value])));
    setAdded(false);
  }

  function navigateGallery(direction: -1 | 1) {
    const entry = galleryImages[(activeImageIndex + direction + galleryImages.length) % galleryImages.length];
    if (entry) selectGalleryImage(entry);
  }

  const handleGalleryKeyDown = useEffectEvent((event: KeyboardEvent) => {
    if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey || event.isComposing) return;
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    // Leave arrow keys to forms, menus, and other controls outside the gallery.
    if (event.target instanceof Node && event.target !== document.body && event.target !== document.documentElement && !galleryRef.current?.contains(event.target)) return;
    const bounds = galleryRef.current?.getBoundingClientRect();
    if (!bounds || bounds.bottom <= 0 || bounds.top >= window.innerHeight) return;
    event.preventDefault();
    navigateGallery(event.key === "ArrowLeft" ? -1 : 1);
  });

  useEffect(() => {
    if (!hasMultipleImages) return;
    document.addEventListener("keydown", handleGalleryKeyDown);
    return () => document.removeEventListener("keydown", handleGalleryKeyDown);
  }, [hasMultipleImages]);

  useEffect(() => {
    const strip = thumbnailsRef.current;
    const selected = strip?.querySelector<HTMLButtonElement>('[aria-pressed="true"]');
    if (!strip || !selected) return;
    // Reveal the design's frame first, then scroll its photos inside the fixed
    // border. scrollIntoView would also move the page vertically.
    function reveal(container: HTMLElement, element: HTMLElement) {
      const left = element.getBoundingClientRect().left - container.getBoundingClientRect().left + container.scrollLeft - 4;
      const right = left + element.offsetWidth + 8;
      if (left < container.scrollLeft) container.scrollLeft = left;
      else if (right > container.scrollLeft + container.clientWidth) container.scrollLeft = right - container.clientWidth;
    }
    const frame = selected.closest<HTMLElement>('[role="group"]');
    if (frame) reveal(strip, frame);
    if (selected.parentElement) reveal(selected.parentElement, selected);
  }, [activeImageIndex]);

  async function handleAdd() {
    if (!variant?.availableForSale) return;
    await addItem(product, variant, Number(quantity));
    setAdded(true);
    window.setTimeout(() => setAdded(false), 2200);
  }

  return (
    <div className="grid gap-8 pb-8 sm:pb-12 lg:grid-cols-2 lg:gap-12">
      <div ref={galleryRef} role="region" aria-label="Product gallery" aria-describedby={hasMultipleImages ? galleryHintId : undefined} className="mx-auto w-full min-w-0 max-w-xl space-y-4 lg:sticky lg:top-28 lg:self-start">
        <div className="relative mx-auto aspect-square w-full overflow-hidden rounded-3xl border border-black/10 bg-white/60 lg:max-w-[max(12rem,calc(100svh-20rem))] dark:border-white/10 dark:bg-white/5">
          {activeImage ? <Image src={activeImage.url} alt={activeImage.altText || product.title} fill preload sizes="(min-width: 1152px) 528px, (min-width: 1024px) calc(50vw - 48px), (min-width: 608px) 576px, calc(100vw - 32px)" className="object-contain" /> : <div className="grid h-full place-items-center font-cooper text-8xl text-black/10 dark:text-white/10">R</div>}
          {hasMultipleImages && (
            <>
              <div className="absolute left-3 top-1/2 -translate-y-1/2">
                <IconButton label="Previous photo" tooltip="Previous photo (←)" variant="overlay" size="md" aria-keyshortcuts="ArrowLeft" data-photo-navigation="previous" onClick={() => navigateGallery(-1)}>
                  <FiChevronLeft aria-hidden className="h-5 w-5" />
                </IconButton>
              </div>
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                <IconButton label="Next photo" tooltip="Next photo (→)" variant="overlay" size="md" aria-keyshortcuts="ArrowRight" data-photo-navigation="next" onClick={() => navigateGallery(1)}>
                  <FiChevronRight aria-hidden className="h-5 w-5" />
                </IconButton>
              </div>
            </>
          )}
        </div>
        {hasMultipleImages && (
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-black/70 dark:text-white/70">
            <p id={galleryHintId}>Scroll photos or use ← and →</p>
            <p role="status" aria-live="polite" aria-atomic="true">Photo {activeImageIndex + 1} of {galleryImages.length}</p>
          </div>
        )}
        {hasMultipleImages && (
          <div ref={thumbnailsRef} role="group" aria-label="Product photos" className="relative flex gap-4 overflow-x-auto overscroll-x-contain p-1 pb-3 [scrollbar-width:thin]">
            {galleryGroups.map((group) => (
              <div key={group.productId} role="group" aria-label={`${group.label} photos`} className="w-max max-w-full shrink-0 overflow-hidden rounded-2xl border border-black/10 py-3 dark:border-white/10">
                <div className="mb-2 flex items-baseline gap-3 whitespace-nowrap px-3">
                  <Kicker>{group.label}</Kicker>
                  <span className="text-xs text-black/70 dark:text-white/70">{group.images.length} {group.images.length === 1 ? "photo" : "photos"}</span>
                </div>
                <div data-photo-scroll className="-my-1 flex gap-3 overflow-x-auto overscroll-x-contain px-3 py-1 [scrollbar-width:thin]">
                  {group.images.map((entry) => (
                    <button key={entry.key} type="button" onClick={() => selectGalleryImage(entry)} aria-label={`View ${entry.label}`} aria-pressed={entry.productId === product.id && activeImage?.url === entry.image.url} className={`relative h-16 w-16 shrink-0 overflow-hidden rounded-xl border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/30 sm:h-20 sm:w-20 dark:focus-visible:ring-white/40 ${entry.productId === product.id && activeImage?.url === entry.image.url ? "border-black dark:border-white" : "border-black/10 dark:border-white/10"}`}>
                      <Image src={entry.image.url} alt="" fill sizes="120px" className="object-contain" />
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="min-w-0">
        <h1 className="font-cooper text-4xl leading-[1.05] tracking-wide text-black dark:text-white sm:text-5xl">{title}</h1>
        <p className="mt-5 text-xl font-semibold" aria-live="polite">{variant ? formatMoney(variant.price) : formatMoney(product.priceRange.minVariantPrice)}</p>
        <ProductDescription description={product.description} descriptionHtml={product.descriptionHtml} part="intro" />
        {designField && <div className="mt-8">{designField}</div>}

        <div className="mt-8 space-y-5">
          {product.options.map((option) => (
            <DropdownSelect
              key={option.id}
              label={option.name}
              variant="field"
              required
              value={selections[option.name] ?? option.values[0]}
              onChange={(value) => selectOption(option.name, value)}
              options={option.values.map((value) => {
                const available = product.variants.some((item) => item.availableForSale && item.selectedOptions.every((selected) => selected.value === (selected.name === option.name ? value : selections[selected.name])));
                return { label: available ? value : `${value} — sold out`, value };
              })}
            />
          ))}
          <DropdownSelect
            label="Quantity"
            variant="field"
            required
            value={quantity}
            onChange={setQuantity}
            options={[1, 2, 3, 4, 5].map((value) => ({ label: String(value), value: String(value) }))}
          />
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
          <Button fullWidth size="lg" loading={loading} loadingText="Adding" disabled={!variant?.availableForSale} leftIcon={added ? <FiCheck /> : <FiShoppingBag />} onClick={handleAdd}>
            {!variant ? "Unavailable" : !variant.availableForSale ? "Sold out" : added ? "Added" : "Add to cart"}
          </Button>
          <Button fullWidth size="lg" variant="secondary" onClick={() => router.push("/cart")}>View cart</Button>
        </div>
        {error && <ErrorCallout className="mt-4">{error}</ErrorCallout>}
        {added && <FormStatus className="mt-4" title="Added to cart" icon={<FiCheck aria-hidden />}>Excellent choice, Ryan. It’s in your cart.</FormStatus>}
        <div className="mt-8 border-t border-black/10 dark:border-white/10">
          <ProductDescription description={product.description} descriptionHtml={product.descriptionHtml} part="details" />
          <div className="grid gap-6 pt-6 text-sm text-black/70 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3 dark:text-white/70">
            {[
              { icon: FiPackage, title: "Made to order", text: "Printed by Printful" },
              { icon: FiShield, title: "Secure checkout", text: "Hosted by Shopify" },
              { icon: FiCheckCircle, title: "Ryan approved", text: "Obviously" },
            ].map(({ icon: Icon, title: label, text }) => (
              <div key={label} className="space-y-2">
                <Icon aria-hidden className="text-xl text-black dark:text-white" />
                <p><strong className="block text-black dark:text-white">{label}</strong>{text}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
