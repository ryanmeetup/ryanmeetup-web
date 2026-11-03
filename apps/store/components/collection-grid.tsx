"use client";

import { useState } from "react";
import { AnimatedCollapse, Button, DropdownSelect, EmptyState, SectionHeader } from "@ryanmeetup/ui";
import { FiArrowRight, FiChevronDown } from "react-icons/fi";
import type { CatalogSections, CollectionSummary, ProductListing } from "@/lib/types";
import { collectionHeading } from "@/lib/catalog-collections";
import { ProductGrid } from "./product-grid";

// With sections, the filters apply within each collection and an emptied section is hidden.
export function CollectionGrid({ products, sections, more = [] }: { products: ProductListing[] } & Partial<CatalogSections>) {
  const [type, setType] = useState("all");
  const [size, setSize] = useState("all");
  const types = [...new Set(products.map((product) => product.productType).filter(Boolean))];
  const sizes = [
    ...new Set(
      products.flatMap((product) =>
        product.options.find((option) => option.name.toLowerCase() === "size")?.values ?? [],
      ),
    ),
  ];
  const matches = (product: ProductListing) =>
    (type === "all" || product.productType === type) &&
    (size === "all" ||
      product.variants.some(
        (variant) =>
          variant.availableForSale &&
          variant.selectedOptions.some(
            (option) => option.name.toLowerCase() === "size" && option.value === size,
          ),
      ));
  const visible = products.filter(matches);
  const visibleSections = [
    ...(sections ?? []).map((section) => ({ ...section, products: section.products.filter(matches) })),
    ...(sections?.length ? [{ collection: null, products: more.filter(matches) }] : []),
  ].filter((section) => section.products.length);

  return (
    <div className="space-y-6">
      {(types.length > 1 || sizes.length > 1) && (
        <div className="flex flex-col gap-3 rounded-2xl border border-black/10 bg-white/60 p-3 sm:flex-row sm:items-center dark:border-white/10 dark:bg-white/5">
          <span className="px-2 text-xs font-semibold uppercase tracking-[0.2em] text-black/55 dark:text-white/55">Filter the goods</span>
          {types.length > 1 && (
            <DropdownSelect
              label="Type"
              value={type}
              onChange={setType}
              options={[{ label: "All types", value: "all" }, ...types.map((value) => ({ label: value, value }))]}
              stackLabelOnMobile
            />
          )}
          {sizes.length > 1 && (
            <DropdownSelect
              label="Size"
              value={size}
              onChange={setSize}
              options={[{ label: "All sizes", value: "all" }, ...sizes.map((value) => ({ label: value, value }))]}
              stackLabelOnMobile
            />
          )}
        </div>
      )}
      {!visible.length ? (
        <EmptyState message="No Ryan gear found. Try another size or product type." />
      ) : visibleSections.length ? (
        <div className="space-y-12">
          {visibleSections.map(({ collection, products: sectionProducts }, index) => (
            <CollapsibleCollection key={collection?.id ?? "more"} collection={collection} products={sectionProducts} eagerCount={index === 0 ? 4 : 0} />
          ))}
        </div>
      ) : (
        <ProductGrid products={visible} />
      )}
    </div>
  );
}

// Sections start open; the heading toggles one closed so a shopper can skip past it.
function CollapsibleCollection({ collection, products, eagerCount }: { collection: CollectionSummary | null; products: ProductListing[]; eagerCount: number }) {
  const [open, setOpen] = useState(true);
  const id = `collection-${collection?.handle ?? "more"}`;
  return (
    <section aria-labelledby={id}>
      <SectionHeader
        title={
          <button
            type="button"
            aria-expanded={open}
            aria-controls={`${id}-panel`}
            onClick={() => setOpen((current) => !current)}
            className="inline-flex cursor-pointer items-center gap-3 rounded-lg text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/40 dark:focus-visible:ring-white/40"
          >
            <span id={id}>{collection ? collectionHeading(collection.title) : "More Ryan goods"}</span>
            <FiChevronDown aria-hidden className={`h-5 w-5 shrink-0 text-black/55 transition-transform duration-200 motion-reduce:transition-none dark:text-white/55 ${open ? "-rotate-180" : ""}`} />
          </button>
        }
        description={collection ? collection.description || undefined : "Everything else on the shelf."}
        meta={`${products.length} item${products.length === 1 ? "" : "s"}`}
        actions={collection && (
          <Button.Link href={`/collections/${collection.handle}`} size="md" variant="secondary" className="!w-full sm:!w-auto" rightIcon={<FiArrowRight />}>
            View collection
          </Button.Link>
        )}
      />
      {/* The gap under the header lives inside the collapse so a closed section is no taller than its header. */}
      <AnimatedCollapse id={`${id}-panel`} open={open} contentClassName="pt-6">
        <ProductGrid products={products} eagerCount={eagerCount} />
      </AnimatedCollapse>
    </section>
  );
}
