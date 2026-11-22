import type { MetadataRoute } from "next";
import { getCollectionPath } from "@/lib/catalog-collections";
import { getGarmentParams, getGarmentPath } from "@/lib/garments";
import { SITE_URL } from "@/lib/metadata";
import { getCollections, getPolicies, getProductSitemapEntries, getStockedGarments } from "@/lib/shopify";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [collections, products, policies, stocked] = await Promise.all([getCollections(), getProductSitemapEntries(), getPolicies(), getStockedGarments()]);
  return [
    { url: SITE_URL, changeFrequency: "weekly", priority: 1 },
    { url: `${SITE_URL}/about`, changeFrequency: "monthly", priority: 0.6 },
    { url: `${SITE_URL}/contact`, changeFrequency: "monthly", priority: 0.6 },
    { url: `${SITE_URL}/reviews`, changeFrequency: "daily", priority: 0.6 },
    ...collections.map((collection) => ({ url: `${SITE_URL}${getCollectionPath(collection.handle)}`, changeFrequency: "daily" as const, priority: 0.8 })),
    ...getGarmentParams().filter(({ department, garment }) => stocked[department]?.includes(garment)).map(({ department, garment }) => ({ url: `${SITE_URL}${getGarmentPath(department, garment)}`, changeFrequency: "daily" as const, priority: 0.7 })),
    ...(policies.length ? [{ url: `${SITE_URL}/policies`, changeFrequency: "yearly" as const, priority: 0.4 }] : []),
    ...policies.map((policy) => ({ url: `${SITE_URL}/policies/${policy.handle}`, changeFrequency: "yearly" as const, priority: 0.3 })),
    ...products.map(({ handle, lastModified }) => ({ url: `${SITE_URL}/products/${handle}`, ...(lastModified ? { lastModified } : {}), changeFrequency: "weekly" as const, priority: 0.7 })),
  ];
}
