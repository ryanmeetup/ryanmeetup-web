import { expect, test } from "@playwright/test";
import { FaBoxesStacked } from "react-icons/fa6";
import { getCollectionMenuRoutes, getDepartmentMenuRoutes, getStoreCollectionIcon, getStoreNavigationSelection } from "../lib/navigation";

const collection = (handle: string, title: string, description = "") => ({ handle, title, description });

test("the collections menu lists featured Shopify collections, then Shop All, without the other type pages", () => {
  const routes = getCollectionMenuRoutes([
    collection("all", "Collections"),
    collection("apparel", "Apparel"),
    collection("accessories", "Accessories"),
    collection("i-heart-ry", "I ❤️ RY", "For all the Ryan lovers out there."),
    collection("name-tag", "Name Tag"),
  ]);
  expect(routes.map(({ href, text, description }) => ({ href, text, description }))).toEqual([
    { href: "https://ryanmeetup.com/cards", text: "RY-Ds", description: "Your official Ryan identification, made just for you." },
    { href: "/collections/i-heart-ry", text: "I ❤️ RY", description: "For all the Ryan lovers out there." },
    { href: "/collections/name-tag", text: "Name Tag", description: undefined },
    { href: "/collections/all", text: "Shop All", description: "Official issue for Ryans, friends of Ryans, and the Ryan-curious." },
  ]);
});

test("without Shopify collections the menu still offers RY-Ds and Shop All", () => {
  expect(getCollectionMenuRoutes([]).map(({ href, text }) => ({ href, text }))).toEqual([
    { href: "https://ryanmeetup.com/cards", text: "RY-Ds" },
    { href: "/collections/all", text: "Shop All" },
  ]);
});

test("each current collection has its own icon, and a new one falls back to the stacked boxes", () => {
  const iconFor = (handle: string) => getStoreCollectionIcon(handle).type;
  const handles = ["all", "apparel", "accessories", "ryd", "i-heart-ry", "name-tag", "ryan-classics", "not-a-cult", "limited-edition", "lunch-money"];
  expect(new Set(handles.map(iconFor)).size).toBe(handles.length);
  expect(iconFor("next-big-drop")).toBe(FaBoxesStacked);
  expect(handles.map(iconFor)).not.toContain(FaBoxesStacked);
});

test("the apparel and accessories menus link each garment page, then the whole type page", () => {
  expect(getDepartmentMenuRoutes("apparel").map(({ href, text }) => ({ href, text }))).toEqual([
    { href: "/apparel/t-shirts", text: "T-Shirts" },
    { href: "/apparel/hoodies", text: "Hoodies & Sweatshirts" },
    { href: "/apparel/hats", text: "Hats" },
    { href: "/apparel/kids", text: "Kids" },
    { href: "/apparel", text: "Shop All Apparel" },
  ]);
  expect(getDepartmentMenuRoutes("accessories").map(({ href }) => href)).toEqual([
    "https://ryanmeetup.com/cards",
    "/accessories/pins",
    "/accessories/bags",
    "/accessories/mugs",
    "/accessories/home-goods",
    "/accessories/flags",
    "/accessories",
  ]);
  const icons = getDepartmentMenuRoutes("accessories").map(({ icon }) => (icon as { type: unknown }).type);
  expect(new Set(icons).size).toBe(icons.length);
  expect(getDepartmentMenuRoutes("not-a-department")).toEqual([]);
});

test("canonical routes own one menu even when another menu contains a shortcut", () => {
  // RY-Ds is deliberately offered by both menus, whether it lives in the Store
  // or links directly to the membership site.
  expect(getDepartmentMenuRoutes("accessories")[0].href).toBe(getCollectionMenuRoutes([])[0].href);
  for (const [path, menu] of [
    ["/collections/ryd", "collections"], ["/collections/name-tag", "collections"], ["/collections/not-in-the-menu", "collections"],
    ["/apparel", "apparel"], ["/apparel/hats", "apparel"], ["/accessories", "accessories"], ["/accessories/pins", "accessories"],
    ["/about", null], ["/contact", null], ["/reviews", null],
  ] as const) expect(getStoreNavigationSelection(path, "/apparel")).toEqual({ path, menu });
});

test("product department claims use the same single canonical owner", () => {
  expect(getStoreNavigationSelection("/products/ryd", "/collections/ryd")).toEqual({ path: "/collections/ryd", menu: "collections" });
  expect(getStoreNavigationSelection("/products/tee", "/apparel")).toEqual({ path: "/apparel", menu: "apparel" });
  expect(getStoreNavigationSelection("/products/mug", "/accessories")).toEqual({ path: "/accessories", menu: "accessories" });
  expect(getStoreNavigationSelection("/products/unknown", null)).toEqual({ path: "/products/unknown", menu: null });
});
