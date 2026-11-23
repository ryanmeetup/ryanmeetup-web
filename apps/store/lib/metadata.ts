import { createPageMetadataBuilder, type PageMetadataImage } from "@ryanmeetup/metadata";
import { splitProductDescription } from "@/lib/product-description";
import type { Product, StoreImage } from "@/lib/types";

export const SITE_NAME = "Ryan Meetup Store";
// Fixed, like RyanMeetup.com: previews and local runs still link to the real store.
export const SITE_URL = "https://store.ryanmeetup.com";
export const SITE_DESCRIPTION = "Official Ryan Meetup shirts, sweatshirts, hats, and assorted Ryan provisions.";

// The social card for pages without their own image.
export const DEFAULT_IMAGE: PageMetadataImage = {
  url: "/share/ryan-meetup-store.jpg",
  width: 1200,
  height: 630,
  alt: "Two Ryans posing deadpan in name tags, one in an I heart RY tee and cap, the other in a Ryan Meetup crewneck holding a pool cue",
};

export const buildPageMetadata = createPageMetadataBuilder({ siteName: SITE_NAME, siteUrl: SITE_URL });

// Shopify leaves dimensions null for some uploads; the card still works without them.
export function toMetadataImage(image: StoreImage, fallbackAlt: string): PageMetadataImage {
  return { url: image.url, alt: image.altText || fallbackAlt, ...(image.width && image.height ? { width: image.width, height: image.height } : {}) };
}

const entities: Record<string, string> = { amp: "&", quot: "\"", apos: "'", lt: "<", gt: ">", nbsp: " " };

// Search results and link previews show roughly 160 characters, so a long
// description is cut at a word rather than mid-word by the reader.
export function toMetaDescription(value: string, maxLength = 160) {
  const text = value.replace(/\s+/g, " ").trim();
  if (text.length <= maxLength) return text;
  const cut = text.slice(0, maxLength - 1);
  return `${cut.slice(0, cut.lastIndexOf(" ")).replace(/[\s,;:–—-]+$/, "")}…`;
}

// Breaks and block ends become spaces so "Ryan.<br>Now" doesn't read as "Ryan.Now"
// and list items don't run together.
export function htmlToText(html: string) {
  return html.replace(/<br\s*\/?>|<\/(p|li|div|h[1-6]|tr|td|th)>/gi, " ").replace(/<[^>]*>/g, "").replace(/&(#\d+|[a-z]+);/gi, (match, name: string) =>
    name.startsWith("#") ? String.fromCodePoint(Number(name.slice(1))) : entities[name.toLowerCase()] ?? match);
}

// The product's intro, not the fabric and sizing details below it. When the
// description has no separate intro, the text before the first bullet stands in.
export function getProductMetaDescription(product: Pick<Product, "description" | "descriptionHtml">) {
  const { intro, html } = splitProductDescription(product);
  const text = (html ? htmlToText(intro) : intro).trim()
    || (product.descriptionHtml.trim() ? htmlToText(product.descriptionHtml) : product.description).split("•")[0];
  return toMetaDescription(text);
}
