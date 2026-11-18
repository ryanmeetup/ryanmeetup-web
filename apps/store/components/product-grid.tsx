import type { ProductListing } from "@/lib/types";
import { MerchGrid } from "./merch-grid";
import { ProductCard } from "./product-card";

export function ProductGrid({ products, eagerCount = 4, evenRows, className, from }: {
  products: ProductListing[];
  from?: string;
  eagerCount?: number;
  evenRows?: boolean;
  className?: string;
}) {
  return (
    <MerchGrid
      evenRows={evenRows}
      className={className}
      items={products.map((product, index) => ({
        key: product.id,
        card: <ProductCard product={product} eager={index < eagerCount} from={from} />,
      }))}
    />
  );
}
