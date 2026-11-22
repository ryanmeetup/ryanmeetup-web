import { buildProductSchema } from "@/lib/product-schema";
import type { ProductSchemaInput } from "@/lib/product-schema";
import { JsonLd } from "./json-ld";

/** Also renders on the server when used inside the interactive product group. */
export function ProductSchema(props: ProductSchemaInput) {
  return <JsonLd id="product-structured-data" data={buildProductSchema(props)} />;
}
