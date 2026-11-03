import type { ProductOption, SelectedOption } from "./types";

// Shopify keeps this placeholder on products without customer-facing options.
// Hide it for display only; variant selection and cart requests still need it.
export function isDefaultTitleOption(option: ProductOption | SelectedOption) {
  const values = "values" in option ? option.values : [option.value];
  return option.name.trim().toLowerCase() === "title"
    && values.length === 1
    && values[0].trim().toLowerCase() === "default title";
}
