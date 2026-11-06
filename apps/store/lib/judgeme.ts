/** Judge.me can retain a different myshopify domain from the catalog API. */
export function getJudgeMeShopDomain() {
  return process.env.JUDGEME_SHOP_DOMAIN || process.env.SHOPIFY_STORE_DOMAIN;
}
