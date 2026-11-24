import type { CatalogSections, Product, ProductListing } from "./types";

/**
 * A product as a card and its quick add read it. Cards are client components, so
 * every field they receive is written into the page; the description and the full
 * photo gallery are only ever read on the product page. The featured image and the
 * variants' own images stay, since swatches and quick add pick photos from them.
 */
function toCardProduct<T extends Product>(product: T): T {
  return { ...product, description: "", descriptionHtml: "", images: product.featuredImage ? [] : product.images.slice(0, 1) };
}

function toCardListing(listing: ProductListing): ProductListing {
  const card = toCardProduct(listing);
  return listing.designs ? { ...card, designs: listing.designs.map((design) => ({ ...design, product: toCardProduct(design.product) })) } : card;
}

type Catalog = { products: ProductListing[] } & Partial<CatalogSections>;

/**
 * Trims every listing a catalog sends to product cards. A listing shown both in
 * `products` and in a section keeps one trimmed object, so the page payload can
 * still write it once and refer back to it.
 */
export function toCardCatalog<T extends Catalog>(catalog: T): T {
  const cards = new Map<ProductListing, ProductListing>();
  const card = (listing: ProductListing) => {
    let trimmed = cards.get(listing);
    if (!trimmed) cards.set(listing, (trimmed = toCardListing(listing)));
    return trimmed;
  };
  return {
    ...catalog,
    products: catalog.products.map(card),
    ...(catalog.sections ? { sections: catalog.sections.map((section) => ({ ...section, products: section.products.map(card) })) } : {}),
    ...(catalog.more ? { more: catalog.more.map(card) } : {}),
  };
}
