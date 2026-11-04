import type { ProductListing } from "./types";

type ExternalListing = { collectionHandles: string[]; listing: ProductListing };

const rydImage = { url: "/listings/ryd.png", altText: "Front and back of the RY-D Ryan Meetup membership card", width: 685, height: 671 };

// Goods sold outside Shopify, listed in Shopify and catalog collections by handle. Each
// leads its collection so it stays in the home page's preview of that collection.
const externalListings: ExternalListing[] = [
  {
    collectionHandles: ["ryan-classics", "accessories"],
    listing: {
      id: "external:ryd",
      handle: "ryd",
      title: "RY-D Membership Card",
      description: "A customized anodized aluminum membership card by Ryan at P&M Apparel.",
      descriptionHtml: "",
      availableForSale: true,
      productType: "Accessory",
      tags: [],
      featuredImage: rydImage,
      images: [rydImage],
      options: [],
      variants: [],
      priceRange: { minVariantPrice: { amount: "35.0", currencyCode: "USD" } },
      externalUrl: "https://ryanmeetup.com/ryd",
    },
  },
];

export function withExternalListings(handle: string, listings: ProductListing[]) {
  const external = externalListings.filter((entry) => entry.collectionHandles.includes(handle)).map((entry) => entry.listing);
  return external.length ? [...external, ...listings] : listings;
}
