import { buildProductSchema } from "@/lib/product-schema";
import type { ProductSchemaInput } from "@/lib/product-schema";

/** Also renders on the server when used inside the interactive product group. */
export function ProductSchema(props: ProductSchemaInput) {
  return (
    <script
      id="product-structured-data"
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(buildProductSchema(props)).replace(/</g, "\\u003c") }}
    />
  );
}
