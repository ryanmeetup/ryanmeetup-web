import type { ProductListing } from "@/lib/types";
import { ProductCard } from "./product-card";

export function ProductGrid({ products, eagerCount = 4, className = "sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" }: {
  products: ProductListing[];
  eagerCount?: number;
  className?: string;
}) {
  return (
    <div className={`grid grid-cols-1 gap-5 ${className}`}>
      {products.map((product, index) => <ProductCard key={product.id} product={product} eager={index < eagerCount} />)}
    </div>
  );
}
