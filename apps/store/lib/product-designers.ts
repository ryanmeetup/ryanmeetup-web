import type { Product } from "./types";

/** Shopify product tags credit the designers of the currently selected design. */
export function getProductDesignerCredit({ tags }: Pick<Product, "tags">): string {
  const names = new Map<string, string>();
  for (const tag of tags) {
    const name = /^designer:\s*(.+)$/i.exec(tag.trim())?.[1].trim().replace(/\s+/g, " ");
    if (name && !names.has(name.toLowerCase())) names.set(name.toLowerCase(), name);
  }
  return new Intl.ListFormat("en", { style: "long", type: "conjunction" }).format([...names.values()]);
}
