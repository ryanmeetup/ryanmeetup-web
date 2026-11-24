import { htmlToText } from "./metadata";
import { BRAND, buildReturnPolicy, SELLER } from "./structured-data";
import type { Product, ProductVariant, ReviewsData } from "./types";

export type ProductSchemaInput = {
  product: Product;
  reviews: ReviewsData;
  url: string;
  title?: string;
  /** Where checkout ships, from Shopify Markets; each offer states the final-sale policy for them. */
  shippingCountries?: string[];
};

type ReturnPolicy = ReturnType<typeof buildReturnPolicy>;

// Option names schema.org has a property for; any other option is an additionalProperty.
const variantProperties: Record<string, "size" | "color" | "material" | "pattern"> = {
  size: "size", color: "color", colour: "color", material: "material", pattern: "pattern",
};

const availability = (available: boolean) => `https://schema.org/${available ? "InStock" : "OutOfStock"}`;

// Shopify's plain `description` runs bullets together ("cotton• Fabric weight"), so the
// HTML is flattened instead, with block ends kept as spaces.
function getSchemaDescription(product: Pick<Product, "description" | "descriptionHtml">) {
  const text = product.descriptionHtml.trim() ? htmlToText(product.descriptionHtml) : product.description;
  return text.replace(/\s+/g, " ").trim();
}

// Google's product test checks each offer, not the store's own node on the home page.
// Shipping is not marked up: rates come from weight tiers quoted only at checkout.
function buildOffer(variant: ProductVariant, url: string, returnPolicy: ReturnPolicy) {
  return {
    "@type": "Offer",
    price: variant.price.amount,
    priceCurrency: variant.price.currencyCode,
    availability: availability(variant.availableForSale),
    itemCondition: "https://schema.org/NewCondition",
    url,
    seller: SELLER,
    ...(returnPolicy ? { hasMerchantReturnPolicy: returnPolicy } : {}),
  };
}

function buildVariant(product: Product, variant: ProductVariant, title: string, url: string, returnPolicy: ReturnPolicy) {
  const known: Record<string, string> = {};
  const additionalProperty: { "@type": "PropertyValue"; name: string; value: string }[] = [];
  for (const option of variant.selectedOptions) {
    const property = variantProperties[option.name.toLowerCase()];
    if (property) known[property] = option.value;
    else additionalProperty.push({ "@type": "PropertyValue", name: option.name, value: option.value });
  }
  return {
    "@type": "Product",
    name: `${title} - ${variant.title}`,
    image: variant.image?.url ?? product.featuredImage?.url,
    ...known,
    ...(additionalProperty.length ? { additionalProperty } : {}),
    offers: buildOffer(variant, url, returnPolicy),
  };
}

/**
 * Product details and complete rating totals must describe the same selected product.
 * A product with options is a ProductGroup with one variant per Shopify variant, the
 * shape Google's merchant listings read sizes, colors, and per-size stock from.
 */
export function buildProductSchema({ product, reviews, url, title = product.title, shippingCountries = [] }: ProductSchemaInput) {
  const returnPolicy = buildReturnPolicy(shippingCountries);
  const shared = {
    "@context": "https://schema.org",
    name: title,
    description: getSchemaDescription(product),
    image: product.images.map((image) => image.url),
    // The listing itself is the canonical page; offers keep the selected design or color.
    url: url.split(/[?#]/)[0],
    brand: BRAND,
    ...(reviews.status === "available" && reviews.count > 0 ? {
      aggregateRating: {
        "@type": "AggregateRating",
        ratingValue: reviews.averageRating.toFixed(1),
        reviewCount: reviews.count,
        bestRating: 5,
        worstRating: 0.5,
      },
    } : {}),
  };
  const [only] = product.variants;
  // "Default Title" is Shopify's lone variant for a product without options.
  if (product.variants.length <= 1) {
    return { ...shared, "@type": "Product", ...(only ? { offers: buildOffer(only, url, returnPolicy) } : {}) };
  }
  const variesBy = [...new Set(product.variants.flatMap((variant) => variant.selectedOptions.map((option) => variantProperties[option.name.toLowerCase()])))]
    .filter(Boolean)
    .map((property) => `https://schema.org/${property}`);
  return {
    ...shared,
    "@type": "ProductGroup",
    productGroupID: product.id.split("/").pop(),
    ...(variesBy.length ? { variesBy } : {}),
    hasVariant: product.variants.map((variant) => buildVariant(product, variant, title, url, returnPolicy)),
  };
}
