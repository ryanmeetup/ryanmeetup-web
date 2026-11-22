/** Public catalog/interface data only. Keep every event within Pro's two-property limit. */
export type StoreEvents = {
  product_clicked: { product: string; placement: string };
  product_card_viewed: { product: string; placement: string };
  collection_clicked: { collection: string; placement: string };
  navigation_clicked: { destination: string; placement: string };
  external_link_clicked: { host: string; placement: string };
  external_product_clicked: { product: string; placement: string };
  section_viewed: { section: string; viewport: string };
  page_scrolled: { depth: number; page: string };
  quick_add_opened: { product: string; mode: "options" | "product_page" | "direct" };
  card_color_previewed: { product: string; color: string };
  product_option_changed: { product: string; choice: string };
  product_design_changed: { product: string; design: string };
  product_photo_selected: { product: string; photo: number };
  catalog_filter_changed: { filter: string; value: string };
  catalog_sort_changed: { collection: string; sort: string };
  catalog_results: { collection: string; count: number };
  collection_toggled: { collection: string; expanded: boolean };
  disclosure_toggled: { section: string; expanded: boolean };
  mobile_navigation_toggled: { expanded: boolean };
  add_to_cart: { product: string; source: "product_page" | "quick_add" };
  cart_quantity_changed: { product: string; quantity: number };
  remove_from_cart: { product: string; quantity: number };
  cart_emptied: { quantity: number };
  cart_drawer_opened: { quantity: number; source: "navigation" | "product_page" | "add_to_cart" };
  cart_drawer_closed: { quantity: number };
  checkout_clicked: { placement: "cart_drawer" | "cart_page"; subtotal: string };
  cart_error: { operation: string; reason: "network" | "rejected" | "server" | "invalid_response" };
  currency_changed: { from: string; to: string };
  currency_error: { currency: string };
  review_filter_changed: { filter: string; value: string };
  review_photo_opened: { photo: number; count: number };
  review_composer_opened: { access: string };
  review_submitted: { outcome: "success" | "error" };
  contact_started: { topic: string };
  contact_submitted: { topic: string; outcome: "success" | "error" };
  page_error: { page: string };
  page_retry: { page: string };
};

export const analyticsPlacements = [
  "home_support", "home_hero", "home_favorites", "home_spotlight", "home_collections", "home_reviews",
  "catalog", "popular_picks", "product", "product_gallery", "product_details", "related_products",
  "reviews", "cart_drawer", "cart_page", "header", "mobile_navigation", "footer", "content",
] as const;
export type AnalyticsPlacement = typeof analyticsPlacements[number];

export function getAnalyticsPlacement(value?: string): AnalyticsPlacement {
  return analyticsPlacements.find((placement) => placement === value) ?? "content";
}

/** Never send support prefills, search text, buyer IDs, callback codes, or URL fragments. */
export function analyticsUrl(value: string): string | null {
  try {
    const url = new URL(value);
    if (/^\/(api|auth)(\/|$)/.test(url.pathname)) return null;
    url.pathname = analyticsPath(url.pathname);
    url.search = "";
    url.hash = "";
    return url.toString();
  } catch {
    return null;
  }
}

export function analyticsPath(path: string): string {
  return /^\/(?:|about|contact|cart|reviews(?:\/mine)?|(?:products|collections|apparel|accessories|policies)(?:\/[a-z0-9-]+)?)$/.test(path)
    ? path : "/other";
}

type LinkEvent =
  | { name: "product_clicked" | "external_product_clicked"; properties: StoreEvents["product_clicked"] }
  | { name: "collection_clicked"; properties: StoreEvents["collection_clicked"] }
  | { name: "navigation_clicked"; properties: StoreEvents["navigation_clicked"] }
  | { name: "external_link_clicked"; properties: StoreEvents["external_link_clicked"] };

export function storeLinkEvent(href: string, current: string, placement: AnalyticsPlacement, product?: string): LinkEvent | null {
  try {
    const origin = new URL(current);
    const url = new URL(href, origin);
    if (!/^https?:$/.test(url.protocol)) return null;
    if (url.origin !== origin.origin) {
      return product && /^[a-z0-9-]+$/.test(product)
        ? { name: "external_product_clicked", properties: { product, placement } }
        : { name: "external_link_clicked", properties: { host: url.hostname, placement } };
    }
    const path = analyticsPath(url.pathname);
    if (path === "/other" || /^\/(api|auth)(\/|$)/.test(url.pathname)) return null;
    if (url.pathname === origin.pathname && url.hash && url.hash !== "#collections" && url.hash !== "#reviews") return null;
    const handle = path.match(/^\/products\/([a-z0-9-]+)$/)?.[1];
    if (handle) return { name: "product_clicked", properties: { product: handle, placement } };
    if (/^\/(collections|apparel|accessories)(\/|$)/.test(path)) {
      return { name: "collection_clicked", properties: { collection: path, placement } };
    }
    return { name: "navigation_clicked", properties: { destination: `${path}${url.hash === "#collections" || url.hash === "#reviews" ? url.hash : ""}`, placement } };
  } catch {
    return null;
  }
}
