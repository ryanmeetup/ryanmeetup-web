import { expect, test } from "@playwright/test";
import { getProductDesignerCredit } from "../lib/product-designers";
import { createProductGroup, getProductGroupForMember } from "../lib/product-groups";
import { dad, ryan } from "./fixtures/products";

test("products without designer credits leave the default copy to the page", () => {
  expect(getProductDesignerCredit({ tags: [] })).toBe("");
  expect(getProductDesignerCredit({ tags: ["listing:Name Tag Shirt", "Ryan", "designer:", "designer:   "] })).toBe("");
});

test("designer tags credit collaborators and ignore duplicate names and extra whitespace", () => {
  expect(getProductDesignerCredit({ tags: [
    "listing:Name Tag Shirt",
    "designer:Ryan One",
    " DESIGNER:  Ryan   Two  ",
    "designer:ryan one",
    "designer:Ryan Three",
  ] })).toBe("Ryan One, Ryan Two, and Ryan Three");
});

test("a grouped listing keeps each design's credits on its underlying product", () => {
  const group = createProductGroup(getProductGroupForMember(ryan)!, [
    { ...ryan, tags: [...ryan.tags, "designer:Ryan One"] },
    { ...dad, tags: [...dad.tags, "designer:Ryan Two", "designer:Ryan Three"] },
  ]);
  expect(group!.designs!.map(({ product }) => getProductDesignerCredit(product))).toEqual(["Ryan One", "Ryan Two and Ryan Three"]);
});
