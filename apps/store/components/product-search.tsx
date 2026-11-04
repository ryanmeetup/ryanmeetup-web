"use client";

import { useSearchFilter } from "@ryanmeetup/hooks";
import { PendingResults, SearchInput, Text } from "@ryanmeetup/ui";
import { getProductTypeCollection } from "@/lib/catalog-collections";
import type { ProductListing } from "@/lib/types";
import { ProductGrid } from "./product-grid";

// Titles carry most of what shoppers type; the type page's name and the Style names
// catch "accessories" or "Ryan's Dad", which only appear outside the title. Each word
// is repeated with an "s" so "shirts" still finds a shirt.
function getSearchText(listing: ProductListing) {
  const text = [listing.title, getProductTypeCollection(listing)?.title, ...(listing.designs?.map((design) => design.label) ?? [])].join(" ").toLowerCase();
  return `${text} ${text.split(/\s+/).map((word) => `${word}s`).join(" ")}`;
}

export function ProductSearch({ listings }: { listings: ProductListing[] }) {
  const { query, setQuery, filtered, isPending } = useSearchFilter({ data: listings, buildHaystack: getSearchText });
  const searched = query.trim();

  return (
    <div className="space-y-6">
      <div className="max-w-2xl">
        <SearchInput
          name="q"
          label="Search products"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Shirts, hats, name tags, assorted Ryan provisions"
          pending={isPending}
          pendingLabel="Loading product results"
          // Arriving here from the header search button means the shopper wants to type.
          autoFocus
          autoComplete="off"
        />
      </div>
      <PendingResults pending={isPending} label="Loading products" surface="page">
        <p className="mb-5 text-xs font-semibold uppercase tracking-widest text-black/70 dark:text-white/70" aria-live="polite">
          {isPending ? "" : searched ? `${filtered.length} result${filtered.length === 1 ? "" : "s"} for “${searched}”` : `${filtered.length} item${filtered.length === 1 ? "" : "s"}`}
        </p>
        {filtered.length ? (
          <ProductGrid products={filtered} />
        ) : (
          <Text className="max-w-2xl">No Ryan provisions match that yet. Try a shorter word, like “shirt” or “hat”.</Text>
        )}
      </PendingResults>
    </div>
  );
}
