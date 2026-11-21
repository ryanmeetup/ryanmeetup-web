"use client";

import { useState } from "react";
import { useQueryParamState } from "@ryanmeetup/hooks";
import { AnchorNav, AnimatedCollapse, DropdownSelect, EmptyState, FilterPanel, Heading, SectionHeader, Text } from "@ryanmeetup/ui";
import { FiChevronDown } from "react-icons/fi";
import type { CatalogSections, CollectionSummary, ProductListing } from "@/lib/types";
import { collectionHeading } from "@/lib/catalog-collections";
import { getGarmentIcon } from "@/lib/navigation";
import { defaultSort, parseSort, sortListings, sortOptions } from "@/lib/sort";
import { ProductGrid } from "./product-grid";

// With sections, the filters and sort apply within each collection and an emptied section
// is hidden. The sort rides in `?sort=` so a reload or shared link keeps it.
export function CollectionGrid({ handle, products, sections, more = [] }: { handle: string; products: ProductListing[] } & Partial<CatalogSections>) {
  const [type, setType] = useState("all");
  const [size, setSize] = useState("all");
  const [sortParam, setSortParam] = useQueryParamState("sort", defaultSort);
  const sort = parseSort(sortParam);
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
  const arrange = (listings: ProductListing[]) => sortListings(listings.filter(matches), sort);
  const visible = arrange(products);
  // Shop All keeps its collection sections, with Popular Picks above them. A pick still
  // appears in its own section too, so every section lists its whole collection.
  // Department pages open straight onto their garment groupings instead.
  const showPopular = sort === defaultSort && Boolean(sections?.length) && !sections?.some((section) => section.grouping);
  const popular = showPopular ? visible.filter((product) => !product.externalUrl).slice(0, 4) : [];
  const visibleSections = [
    ...(sections ?? []).map((section) => ({ ...section, products: arrange(section.products) })),
    ...(sections?.length ? [{ collection: null, products: arrange(more), grouping: false }] : []),
  ].filter((section) => section.products.length);
  // Apparel and Accessories float a jump link for each garment grouping still showing.
  const anchors = visibleSections.flatMap(({ collection, grouping }) =>
    grouping && collection ? [{ href: `#${collection.handle}`, tooltip: collection.title, icon: getGarmentIcon(handle, collection.handle, "h-5 w-5") }] : [],
  );

  return (
    <div className="space-y-6">
      {products.length > 1 && (
        <FilterPanel
          count={Number(type !== "all") + Number(size !== "all")}
          controlsClassName="grid grid-cols-1 items-stretch gap-3 overflow-visible lg:flex lg:items-center"
        >
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
          {/* The controls stack until lg, matching where stackLabelOnMobile goes inline. */}
          <DropdownSelect
            label="Sort"
            value={sort}
            onChange={setSortParam}
            options={sortOptions.map(({ label, value }) => ({ label, value }))}
            stackLabelOnMobile
            className="lg:ml-auto"
          />
        </FilterPanel>
      )}
      {!visible.length ? (
        <EmptyState message="No Ryan gear found. Try another size or product type." />
      ) : visibleSections.length || popular.length ? (
        <div className="space-y-6">
          {popular.length > 0 && (
            <section aria-labelledby="popular-picks">
              <SectionHeader align="left" title={<span id="popular-picks">Popular Picks</span>} />
              <ProductGrid products={popular} from={handle} className="mt-6" />
            </section>
          )}
          {visibleSections.map(({ collection, products: sectionProducts, grouping }, index) => (
            <CollapsibleCollection key={collection?.id ?? "more"} from={handle} collection={collection} grouping={grouping} products={sectionProducts} eagerCount={!popular.length && index === 0 ? 4 : 0} />
          ))}
        </div>
      ) : (
        <ProductGrid products={visible} from={handle} />
      )}
      {/* Fixed in place, so it sits last where the stack's spacing can't reach anything. */}
      {anchors.length > 1 && <AnchorNav items={anchors} label="Jump to a grouping" />}
    </div>
  );
}

// Sections start open; the heading toggles one closed so a shopper can skip past it.
// A garment grouping keeps its plain title and is anchored by its handle, as in `#hats`.
// The header menus provide navigation to each collection's own page.
function CollapsibleCollection({ from, collection, grouping = false, products, eagerCount }: { from: string; collection: CollectionSummary | null; grouping?: boolean; products: ProductListing[]; eagerCount: number }) {
  const [open, setOpen] = useState(true);
  const id = `collection-${collection?.handle ?? "more"}`;
  const description = collection ? collection.description : "Everything else on the shelf.";
  return (
    <section aria-labelledby={id} id={grouping ? collection?.handle : undefined} className={`border-t border-black/10 pt-6 first:border-t-0 first:pt-0 dark:border-white/10${grouping ? " scroll-mt-24" : ""}`}>
      <Heading size="h2" aria-labelledby={id} className="min-w-0 text-2xl sm:text-4xl">
        <button
          type="button"
          aria-labelledby={id}
          aria-describedby={`${id}-count`}
          aria-expanded={open}
          aria-controls={`${id}-panel`}
          onClick={() => setOpen((current) => !current)}
          className="grid min-h-11 w-full cursor-pointer grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-3 rounded-lg text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/40 sm:gap-4 dark:focus-visible:ring-white/40"
        >
          <span id={id} className="min-w-0">{collection ? (grouping ? collection.title : collectionHeading(collection.title)) : "More Ryan Goods"}</span>
          <span id={`${id}-count`} className="whitespace-nowrap font-sans text-xs font-semibold tracking-normal text-black/70 dark:text-white/70">
            {products.length} item{products.length === 1 ? "" : "s"}
          </span>
          <FiChevronDown aria-hidden className={`h-5 w-5 shrink-0 text-black/55 transition-transform duration-200 motion-reduce:transition-none dark:text-white/55 ${open ? "-rotate-180" : ""}`} />
        </button>
      </Heading>
      {/* Keep spacing inside the clipped content so closed panels occupy no height. */}
      <AnimatedCollapse id={`${id}-panel`} open={open}>
        <div>
          {description && <Text className="pt-2">{description}</Text>}
          <div className="pt-6">
            <ProductGrid products={products} eagerCount={eagerCount} from={from} />
          </div>
        </div>
      </AnimatedCollapse>
    </section>
  );
}
