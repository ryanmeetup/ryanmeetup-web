import { createPageMetadataBuilder, type PageMetadataImage } from "@ryanmeetup/metadata";
import type { StoreImage } from "@/lib/types";

export const SITE_NAME = "Ryan Meetup Store";
// Fixed, like RyanMeetup.com: previews and local runs still link to the real store.
export const SITE_URL = "https://store.ryanmeetup.com";

// The social card for pages without their own image.
export const DEFAULT_IMAGE: PageMetadataImage = {
  url: "/hero/ryan-merch-table.jpg",
  width: 1800,
  height: 1199,
  alt: "Ryans browsing official Ryan Meetup shirts and hats at a merch table",
};

export const buildPageMetadata = createPageMetadataBuilder({ siteName: SITE_NAME, siteUrl: SITE_URL });

// Shopify leaves dimensions null for some uploads; the card still works without them.
export function toMetadataImage(image: StoreImage, fallbackAlt: string): PageMetadataImage {
  return { url: image.url, alt: image.altText || fallbackAlt, ...(image.width && image.height ? { width: image.width, height: image.height } : {}) };
}
