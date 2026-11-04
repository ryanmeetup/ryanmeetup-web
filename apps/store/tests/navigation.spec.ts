import { expect, test } from "@playwright/test";
import { FaBoxesStacked } from "react-icons/fa6";
import { getCollectionMenuRoutes, getStoreCollectionIcon } from "../lib/navigation";

const collection = (handle: string, title: string, description = "") => ({ handle, title, description });

test("the collections menu lists featured Shopify collections, then Shop all, without the other type pages", () => {
  const routes = getCollectionMenuRoutes([
    collection("all", "Collections"),
    collection("apparel", "Apparel"),
    collection("accessories", "Accessories"),
    collection("i-heart-ry", "I ❤️ RY", "For all the Ryan lovers out there."),
    collection("name-tag", "Name Tag"),
  ]);
  expect(routes.map(({ href, text, description }) => ({ href, text, description }))).toEqual([
    { href: "/collections/i-heart-ry", text: "I ❤️ RY", description: "For all the Ryan lovers out there." },
    { href: "/collections/name-tag", text: "Name Tag", description: undefined },
    { href: "/collections/all", text: "Shop all", description: "Official issue for Ryans, friends of Ryans, and the Ryan-curious." },
  ]);
});

test("without Shopify collections the menu still offers Shop all", () => {
  expect(getCollectionMenuRoutes([]).map(({ href, text }) => ({ href, text }))).toEqual([
    { href: "/collections/all", text: "Shop all" },
  ]);
});

test("each current collection has its own icon, and a new one falls back to the stacked boxes", () => {
  const iconFor = (handle: string) => getStoreCollectionIcon(handle).type;
  const handles = ["all", "apparel", "accessories", "i-heart-ry", "name-tag", "ryan-classics"];
  expect(new Set(handles.map(iconFor)).size).toBe(handles.length);
  expect(iconFor("next-big-drop")).toBe(FaBoxesStacked);
  expect(handles.map(iconFor)).not.toContain(FaBoxesStacked);
});
