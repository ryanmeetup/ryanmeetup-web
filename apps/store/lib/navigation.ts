import { createElement } from "react";
import type { NavRoute } from "@ryanmeetup/ui";
import { FiInfo, FiMail, FiTag } from "react-icons/fi";
import { FaAddressCard, FaBaby, FaBagShopping, FaBoxesStacked, FaBurger, FaFlag, FaHeart, FaHouse, FaIdBadge, FaMugHot, FaRecordVinyl, FaShirt, FaStar, FaStore, FaTableCellsLarge, FaThumbtack, FaUsers } from "react-icons/fa6";
import { PiBaseballCapFill, PiHoodieFill } from "react-icons/pi";
import type { IconType } from "react-icons";
import { getCatalogCollection, getCollectionPath } from "./catalog-collections";
import { findGarment, garmentsByDepartment, getGarmentPath } from "./garments";
import type { CollectionSummary } from "./types";

export const StoreHomeIcon = FaStore;
export const StoreCollectionIcon = FaBoxesStacked;
export const StoreProductIcon = FiTag;

// Every shopping entry opens a menu. Apparel and Accessories list their garment pages,
// then the whole type page; Collections lists the Shopify collections
// being featured right now, then Shop All.
export const storeNavigation = [
  {
    href: "/about",
    label: "About",
    description: "Who makes the goods and where the money goes.",
    icon: FiInfo,
  },
  {
    menu: "apparel",
    label: "Apparel",
    description: "Shirts, sweatshirts, and wearable Ryan pride.",
    icon: FaShirt,
  },
  {
    menu: "accessories",
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
    href: "/reviews",
    label: "Reviews",
    description: "What Ryans (and the people who love them) say about the goods.",
    icon: FaStar,
  },
  {
    href: "/contact",
    label: "Contact",
    description: "Get help with an order or product.",
    icon: FiMail,
  },
] as const;

export type StoreMenu = Extract<(typeof storeNavigation)[number], { menu: string }>["menu"];

/** Canonical page paths own their menu; duplicate shortcut links do not. */
export function getStoreNavigationSelection(pathname: string, productSection: string | null) {
  // Only products need a page-supplied department. Ignore a departing product's
  // claim on other routes while React cleans up its effect during navigation.
  const path = pathname.startsWith("/products/") && productSection ? productSection : pathname;
  const menu = storeNavigation.find((item) => "menu" in item &&
    (path === `/${item.menu}` || path.startsWith(`/${item.menu}/`)));
  return { path, menu: menu && "menu" in menu ? menu.menu : null };
}

// Keyed by Shopify handle. Give each new collection its own icon here; one without an
// entry falls back to the stacked boxes.
const collectionIcons: Record<string, IconType> = {
  all: FaTableCellsLarge,
  apparel: FaShirt,
  accessories: FiTag,
  ryd: FaAddressCard,
  "i-heart-ry": FaHeart,
  "lunch-money": FaBurger,
  "name-tag": FaIdBadge,
  "ryan-classics": FaRecordVinyl,
  "not-a-cult": FaUsers,
  "limited-edition": FaStar,
};

// Keyed by garment handle from `garmentsByDepartment`; a new grouping without an entry
// falls back to its department's icon.
const garmentIcons: Record<string, IconType> = {
  "t-shirts": FaShirt,
  hoodies: PiHoodieFill,
  hats: PiBaseballCapFill,
  kids: FaBaby,
  pins: FaThumbtack,
  bags: FaBagShopping,
  mugs: FaMugHot,
  ryd: FaAddressCard,
  "home-goods": FaHouse,
  flags: FaFlag,
};

export type StoreMenuCollection = Pick<CollectionSummary, "handle" | "title" | "description">;

/** RY-Ds and featured Shopify collections, then Shop All; type pages have their own links. */
export function getCollectionMenuRoutes(collections: StoreMenuCollection[]): NavRoute[] {
  const shopAll = getCatalogCollection("all");
  const ryd = findGarment("accessories", "ryd");
  const featured = collections.filter(({ handle }) => handle !== "ryd" && !getCatalogCollection(handle));
  return [
    ...(ryd ? [ryd] : []),
    ...featured,
    ...(shopAll ? [{ ...shopAll, title: "Shop All" }] : []),
  ].map(({ handle, title, description }) => ({
    href: getCollectionPath(handle),
    text: title,
    description: description || undefined,
    icon: getStoreCollectionIcon(handle),
  }));
}

/** Garment handles with at least one listing, keyed by department; null lists every grouping. */
export type StockedGarments = Record<string, readonly string[]> | null;

/**
 * A type page's garment groupings, each linking to its own page, then the whole type page.
 * Pass `stocked` to leave out groupings with nothing in them, such as a sold-out door mat.
 */
export function getDepartmentMenuRoutes(department: string, stocked: StockedGarments = null): NavRoute[] {
  const page = getCatalogCollection(department);
  if (!page) return [];
  const inStock = stocked?.[department];
  return [
    ...(garmentsByDepartment[department] ?? []).filter(({ handle }) => !inStock || inStock.includes(handle)).map(({ handle, title, description }) => ({
      href: getGarmentPath(department, handle),
      text: title,
      description,
      icon: getGarmentIcon(department, handle),
    })),
    {
      href: getCollectionPath(department),
      text: `Shop All ${page.title}`,
      description: page.description,
      icon: getStoreCollectionIcon("all"),
    },
  ];
}

export function getGarmentIcon(department: string, handle: string, className = "shrink-0") {
  return createElement(garmentIcons[handle] ?? collectionIcons[department] ?? FaBoxesStacked, { "aria-hidden": true, className });
}

export function getStoreCollectionIcon(handle: string) {
  return createElement(collectionIcons[handle] ?? FaBoxesStacked, { "aria-hidden": true, className: "shrink-0" });
}
