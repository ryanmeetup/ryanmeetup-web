import { createElement } from "react";
import type { NavRoute } from "@ryanmeetup/ui";
import { FiInfo, FiMail, FiTag } from "react-icons/fi";
import { FaBoxesStacked, FaHeart, FaIdBadge, FaRecordVinyl, FaShirt, FaStore, FaTableCellsLarge } from "react-icons/fa6";
import type { IconType } from "react-icons";
import { getCatalogCollection } from "./catalog-collections";
import type { CollectionSummary } from "./types";

export const StoreHomeIcon = FaStore;
export const StoreCollectionIcon = FaBoxesStacked;
export const StoreProductIcon = FiTag;

// Apparel and Accessories are standing type pages. The Collections entry opens a menu
// of the Shopify collections being featured right now, then Shop all.
export const storeNavigation = [
  {
    href: "/about",
    label: "About",
    description: "Who makes the goods and where the money goes.",
    icon: FiInfo,
  },
  {
    href: "/collections/apparel",
    label: "Apparel",
    description: "Shirts, sweatshirts, and wearable Ryan pride.",
    icon: FaShirt,
  },
  {
    href: "/collections/accessories",
    label: "Accessories",
    description: "The finishing touches for a fully equipped Ryan.",
    icon: FiTag,
  },
  {
    menu: "collections",
    label: "Collections",
    description: "The groups of goods we're featuring right now.",
    icon: FaBoxesStacked,
  },
  {
    href: "/contact",
    label: "Contact",
    description: "Get help with an order or product.",
    icon: FiMail,
  },
] as const;

// Keyed by Shopify handle. Give each new collection its own icon here; one without an
// entry falls back to the stacked boxes.
const collectionIcons: Record<string, IconType> = {
  all: FaTableCellsLarge,
  apparel: FaShirt,
  accessories: FiTag,
  "i-heart-ry": FaHeart,
  "name-tag": FaIdBadge,
  "ryan-classics": FaRecordVinyl,
};

export type StoreMenuCollection = Pick<CollectionSummary, "handle" | "title" | "description">;

/** The featured Shopify collections, then Shop all; Apparel and Accessories have their own links. */
export function getCollectionMenuRoutes(collections: StoreMenuCollection[]): NavRoute[] {
  const shopAll = getCatalogCollection("all");
  const featured = collections.filter(({ handle }) => !getCatalogCollection(handle));
  return [
    ...featured,
    ...(shopAll ? [{ ...shopAll, title: "Shop all" }] : []),
  ].map(({ handle, title, description }) => ({
    href: `/collections/${handle}`,
    text: title,
    description: description || undefined,
    icon: getStoreCollectionIcon(handle),
  }));
}

export function getStoreCollectionIcon(handle: string) {
  return createElement(collectionIcons[handle] ?? FaBoxesStacked, { "aria-hidden": true, className: "shrink-0" });
}
