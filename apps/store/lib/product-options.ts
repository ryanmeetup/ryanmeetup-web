import type { Product, ProductOption, ProductVariant, SelectedOption } from "./types";

// Shopify keeps this placeholder on products without customer-facing options.
// Hide it for display only; variant selection and cart requests still need it.
export function isDefaultTitleOption(option: ProductOption | SelectedOption) {
  const values = "values" in option ? option.values : [option.value];
  return option.name.trim().toLowerCase() === "title"
    && values.length === 1
    && values[0].trim().toLowerCase() === "default title";
}

export function findVariant(product: Pick<Product, "variants">, selections: Record<string, string>) {
  return product.variants.find((variant) => variant.selectedOptions.every((option) => selections[option.name] === option.value));
}

export function getSelections(variant: ProductVariant | undefined): Record<string, string> {
  return Object.fromEntries(variant?.selectedOptions.map((option) => [option.name, option.value]) ?? []);
}

// Dropdown choices for one option, flagging values that are sold out alongside
// the shopper's other selections.
export function getOptionChoices(product: Pick<Product, "variants">, option: ProductOption, selections: Record<string, string>) {
  return option.values.map((value) => {
    const available = product.variants.some((variant) => variant.availableForSale && variant.selectedOptions.every((selected) => selected.value === (selected.name === option.name ? value : selections[selected.name])));
    return { label: available ? value : `${value} — sold out`, value };
  });
}

export const oneSize = "One size";

export function isSizeOption(option: Pick<ProductOption, "name">) {
  return option.name.trim().toLowerCase() === "size";
}

// Shopify leaves the Size option off one-size products; say so where a size
// would otherwise appear.
export function withOneSize(options: SelectedOption[]): SelectedOption[] {
  return options.some(isSizeOption) ? options : [{ name: "Size", value: oneSize }, ...options];
}

const sizeRanks = ["xxs", "xs", "s", "m", "l", "xl", "2xl", "3xl", "4xl", "5xl", "6xl"];
const sizeAliases: Record<string, string> = { xxl: "2xl", xxxl: "3xl", small: "s", medium: "m", large: "l" };

function getSizeRank(value: string) {
  const key = value.trim().toLowerCase().replace(/\s+/g, "");
  return sizeRanks.indexOf(sizeAliases[key] ?? key);
}

// Shopify lists sizes in the order they were added, and merging a listing's
// designs appends whatever one design adds, so S can land after 5XL. Put
// recognized sizes smallest first; anything unrecognized keeps its place.
export function sortOptionValues<T extends Pick<ProductOption, "name" | "values">>(option: T): T {
  if (!isSizeOption(option) || option.values.some((value) => getSizeRank(value) < 0)) return option;
  return { ...option, values: [...option.values].sort((a, b) => getSizeRank(a) - getSizeRank(b)) };
}
