"use client";

import Image from "next/image";
import { useEffect, useEffectEvent, useId, useRef, useState } from "react";
import type { ReactNode } from "react";
import { Button, DropdownSelect, ErrorCallout, IconButton, Kicker, getFieldLabelClasses } from "@ryanmeetup/ui";
import { FiCheck, FiChevronLeft, FiChevronRight, FiHeart, FiPenTool, FiShield, FiShoppingBag } from "react-icons/fi";
import { getCompareAtPrice, getListingSale } from "@/lib/money";
import { findVariant, getOptionChoices, getSelections, isDefaultTitleOption, isSizeOption, oneSize } from "@/lib/product-options";
import { getColorOption, getColorSlug, getVariantForColor } from "@/lib/product-colors";
import { getProductGallery, getVariantForImage, groupProductGallery } from "@/lib/product-gallery";
import type { ProductGalleryImage } from "@/lib/product-gallery";
import { getProductDesignerCredit } from "@/lib/product-designers";
import type { Product, StoreImage } from "@/lib/types";
import { useCart } from "./cart-provider";
import { PriceBadge } from "./price-badge";
import { ProductDescription } from "./product-description";
import { SaleBadge } from "./sale-badge";

export function ProductDetail({ product, title = product.title, breadcrumbs, designField, hideColorOption = false, gallery, initialImage, initialColor, onSelectGalleryImage }: {
  product: Product;
  title?: string;
  // Rides along above the gallery so the trail stays in view while it sticks.
  breadcrumbs?: ReactNode;
  // Receives the live option state so a field outside the product can mirror it.
  designField?: (state: { selections: Record<string, string>; selectOption: (name: string, value: string) => void }) => ReactNode;
  // Set when designField already chooses the color across a listing.
  hideColorOption?: boolean;
  gallery?: ProductGalleryImage[];
  initialImage?: StoreImage;
  initialColor?: string | null;
  onSelectGalleryImage?: (image: ProductGalleryImage) => void;
}) {
  const { addItem, error, loading, setDrawerOpen } = useCart();
  const initialVariant = getVariantForColor(product, initialColor)
    ?? getVariantForImage(product, initialImage ?? product.featuredImage)
    ?? product.variants.find((variant) => variant.availableForSale) ?? product.variants[0];
  const [selections, setSelections] = useState(() => getSelections(initialVariant));
  const [quantity, setQuantity] = useState("1");
  const [added, setAdded] = useState(false);
  const [activeImage, setActiveImage] = useState(initialImage ?? initialVariant?.image ?? product.featuredImage ?? product.images[0] ?? null);
  const galleryImages = gallery ?? getProductGallery(product);
  const galleryGroups = groupProductGallery(galleryImages);
  const galleryRef = useRef<HTMLDivElement>(null);
  const thumbnailsRef = useRef<HTMLDivElement>(null);
  // Whether thumbnails are hidden past each edge of the strip.
  const [clippedStart, setClippedStart] = useState(false);
  const [clippedEnd, setClippedEnd] = useState(false);
  const galleryHintId = useId();
  const hasMultipleImages = galleryImages.length > 1;
  const activeImageIndex = Math.max(0, galleryImages.findIndex((entry) => entry.productId === product.id && entry.image.url === activeImage?.url));
  const variant = findVariant(product, selections);
  // Until a size is chosen, the struck price belongs to the lowest price shown.
  const compareAtPrice = variant ? getCompareAtPrice(variant) : getListingSale(product).compareAt;

  function rememberColor(color: string) {
    const url = new URL(window.location.href);
    url.searchParams.set("color", getColorSlug(color));
    window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
  }

  function selectOption(name: string, value: string) {
    const nextSelections = { ...selections, [name]: value };
    setSelections(nextSelections);
    const nextVariant = findVariant(product, nextSelections);
    if (nextVariant?.image) setActiveImage(nextVariant.image);
    if (name === getColorOption(product)?.name) rememberColor(value);
    setAdded(false);
  }

  function selectGalleryImage(entry: ProductGalleryImage) {
    if (entry.productId !== product.id) {
      onSelectGalleryImage?.(entry);
      return;
    }
    setActiveImage(entry.image);
    const imageVariant = getVariantForImage(product, entry.image, selections);
    if (imageVariant) {
      setSelections(getSelections(imageVariant));
      const color = imageVariant.selectedOptions.find((option) => option.name === getColorOption(product)?.name)?.value;
      if (color) rememberColor(color);
    }
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
    // Reveal the design's frame, then the photo itself when the frame is wider
    // than the strip. scrollIntoView would also move the page vertically.
    // Clear the pinned edge rule and the gap after it.
    const margin = 17;
    function reveal(container: HTMLElement, element: HTMLElement) {
      const left = element.getBoundingClientRect().left - container.getBoundingClientRect().left + container.scrollLeft - margin;
      const right = left + element.offsetWidth + margin * 2;
      if (left < container.scrollLeft) container.scrollLeft = left;
      else if (right > container.scrollLeft + container.clientWidth) container.scrollLeft = right - container.clientWidth;
    }
    const frame = selected.closest<HTMLElement>('[role="group"]');
    function revealSelected() {
      if (frame) reveal(strip!, frame);
      reveal(strip!, selected!);
    }
    revealSelected();
    const observer = new ResizeObserver(revealSelected);
    observer.observe(strip);
    if (frame) observer.observe(frame);
    return () => observer.disconnect();
  }, [activeImageIndex]);

  useEffect(() => {
    const strip = thumbnailsRef.current;
    if (!strip) return;
    function update() {
      setClippedStart(strip!.scrollLeft > 1);
      setClippedEnd(strip!.scrollLeft < strip!.scrollWidth - strip!.clientWidth - 1);
    }
    update();
    strip.addEventListener("scroll", update, { passive: true });
    const observer = new ResizeObserver(update);
    observer.observe(strip);
    return () => {
      strip.removeEventListener("scroll", update);
      observer.disconnect();
    };
  }, [hasMultipleImages]);

  async function handleAdd() {
    if (!variant?.availableForSale) return;
    await addItem(product, variant, Number(quantity));
    setAdded(true);
    window.setTimeout(() => setAdded(false), 2200);
  }

  return (
    <div className="grid gap-8 pb-8 sm:pb-12 lg:grid-cols-2 lg:gap-12">
      <div className="min-w-0 space-y-8 lg:sticky lg:top-28 lg:self-start">
        {breadcrumbs}
        <div ref={galleryRef} role="region" aria-label="Product gallery" aria-describedby={hasMultipleImages ? galleryHintId : undefined} className="mx-auto w-full min-w-0 max-w-xl space-y-4">
          <div className={`relative mx-auto aspect-square w-full overflow-hidden rounded-3xl border border-black/10 bg-white/60 dark:border-white/10 dark:bg-white/5 ${breadcrumbs ? "lg:max-w-[max(12rem,calc(100svh-24rem))]" : "lg:max-w-[max(12rem,calc(100svh-20rem))]"}`}>
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
            <div ref={thumbnailsRef} role="group" aria-label="Product photos" className="relative flex gap-4 overflow-x-auto overscroll-x-contain pb-3 [scrollbar-width:thin]">
              {/* Pinned edge rules stretch to the frames' height, not the scrollbar's padding,
                  and appear only while thumbnails are hidden past that edge. */}
              <span aria-hidden className={`sticky left-0 z-10 w-px shrink-0 bg-black/10 transition-opacity dark:bg-white/10 ${clippedStart ? "" : "opacity-0"}`} />
              {galleryGroups.map((group) => (
                <div key={`${group.productId}:${group.label}`} role="group" aria-label={`${group.label} photos`} className="w-max shrink-0 rounded-2xl border border-black/10 py-3 dark:border-white/10">
                  <Kicker className="mb-2 px-3">{group.label}</Kicker>
                  <div className="flex gap-3 px-3">
                    {group.images.map((entry) => (
                      <button key={entry.key} type="button" onClick={() => selectGalleryImage(entry)} aria-label={`View ${entry.label}`} aria-pressed={entry.productId === product.id && activeImage?.url === entry.image.url} className={`relative h-16 w-16 shrink-0 overflow-hidden rounded-xl border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/30 sm:h-20 sm:w-20 dark:focus-visible:ring-white/40 ${entry.productId === product.id && activeImage?.url === entry.image.url ? "border-black dark:border-white" : "border-black/10 dark:border-white/10"}`}>
                        <Image src={entry.image.url} alt="" fill sizes="120px" className="object-contain" />
                      </button>
                    ))}
                  </div>
                </div>
              ))}
              <span aria-hidden className={`sticky right-0 z-10 w-px shrink-0 bg-black/10 transition-opacity dark:bg-white/10 ${clippedEnd ? "" : "opacity-0"}`} />
            </div>
          )}
        </div>
      </div>
      <div className="min-w-0">
        <h1 className="font-cooper text-4xl leading-[1.05] tracking-wide text-black dark:text-white sm:text-5xl">{title}</h1>
        <div className="mt-5 flex flex-wrap items-center gap-x-3 gap-y-2" aria-live="polite">
          <PriceBadge price={variant ? variant.price : product.priceRange.minVariantPrice} compareAt={compareAtPrice} size="lg" />
          {compareAtPrice && <SaleBadge />}
        </div>
        <ProductDescription description={product.description} descriptionHtml={product.descriptionHtml} part="intro" />
        {designField && <div className="mt-8">{designField({ selections, selectOption })}</div>}

        <div className="mt-8 space-y-5">
          {!product.options.some(isSizeOption) && <SizeDisplay value={oneSize} />}
          {product.options.filter((option) => !isDefaultTitleOption(option) && !(hideColorOption && option === getColorOption(product))).map((option) => isSizeOption(option) && option.values.length === 1 ? (
            <SizeDisplay key={option.id} value={option.values[0]} />
          ) : (
            <DropdownSelect
              key={option.id}
              label={option.name}
              variant="field"
              required
              value={selections[option.name] ?? option.values[0]}
              onChange={(value) => selectOption(option.name, value)}
              options={getOptionChoices(product, option, selections)}
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
          <Button fullWidth size="lg" variant="secondary" onClick={() => setDrawerOpen(true)}>View cart</Button>
        </div>
        {error && <ErrorCallout className="mt-4">{error}</ErrorCallout>}
        <div className="mt-8 border-t border-black/10 dark:border-white/10">
          <ProductDescription description={product.description} descriptionHtml={product.descriptionHtml} part="details" />
          <div className="grid gap-6 pt-6 text-sm text-black/70 sm:grid-cols-2 dark:text-white/70">
            {[
              { icon: FiPenTool, title: "Designed by Ryan", text: getProductDesignerCredit(product) || "Designed in-house by one of our Ryans." },
              { icon: FiShield, title: "Secure checkout", text: "Hosted by Shopify" },
              { icon: FiHeart, title: "Supports Ryan Meetup", text: "Helps fund Ryan gatherings" },
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

/** A size with nothing to choose, shown where the Size field would be. */
function SizeDisplay({ value }: { value: string }) {
  return (
    <div>
      <p className={getFieldLabelClasses()}>Size</p>
      <p className="mt-2 text-sm text-black/70 dark:text-white/70">{value}</p>
    </div>
  );
}
