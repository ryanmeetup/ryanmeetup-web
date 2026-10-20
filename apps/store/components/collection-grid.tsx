"use client";

import { useMemo, useState } from "react";
import { DropdownSelect, EmptyState } from "@ryanmeetup/ui";
import type { ProductListing } from "@/lib/types";
import { ProductCard } from "./product-card";

export function CollectionGrid({ products }: { products: ProductListing[] }) {
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
  const visible = useMemo(
    () =>
      products.filter(
        (product) =>
          (type === "all" || product.productType === type) &&
          (size === "all" ||
            product.variants.some(
              (variant) =>
                variant.availableForSale &&
                variant.selectedOptions.some(
                  (option) => option.name.toLowerCase() === "size" && option.value === size,
                ),
            )),
      ),
    [products, size, type],
  );

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
      {visible.length ? (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {visible.map((product, index) => <ProductCard key={product.id} product={product} eager={index < 4} />)}
        </div>
      ) : (
        <EmptyState message="No Ryan gear found. Try another size or product type." />
      )}
    </div>
  );
}
