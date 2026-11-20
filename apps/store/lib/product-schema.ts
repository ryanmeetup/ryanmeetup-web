import type { Product, ReviewsData } from "./types";

export type ProductSchemaInput = {
  product: Product;
  reviews: ReviewsData;
  url: string;
  title?: string;
};

/** Product details and complete rating totals must describe the same selected product. */
export function buildProductSchema({ product, reviews, url, title = product.title }: ProductSchemaInput) {
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: title,
    description: product.description,
    image: product.images.map((image) => image.url),
    offers: {
      "@type": "AggregateOffer",
      priceCurrency: product.priceRange.minVariantPrice.currencyCode,
      lowPrice: product.priceRange.minVariantPrice.amount,
      offerCount: product.variants.length,
      availability: product.availableForSale ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
      url,
    },
    ...(reviews.status === "available" && reviews.count > 0 ? {
      aggregateRating: {
        "@type": "AggregateRating",
        ratingValue: reviews.averageRating.toFixed(1),
        reviewCount: reviews.count,
      },
    } : {}),
  };
}
