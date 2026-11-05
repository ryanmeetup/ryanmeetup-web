import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/metadata";
import { getCollections, getPolicies, getProductHandles } from "@/lib/shopify";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [collections, productHandles, policies] = await Promise.all([getCollections(), getProductHandles(), getPolicies()]);
  return [
    { url: SITE_URL, changeFrequency: "weekly", priority: 1 },
    { url: `${SITE_URL}/about`, changeFrequency: "monthly", priority: 0.6 },
    { url: `${SITE_URL}/contact`, changeFrequency: "monthly", priority: 0.6 },
    ...collections.map((collection) => ({ url: `${SITE_URL}/collections/${collection.handle}`, changeFrequency: "daily" as const, priority: 0.8 })),
    ...policies.map((policy) => ({ url: `${SITE_URL}/policies/${policy.handle}`, changeFrequency: "yearly" as const, priority: 0.3 })),
    ...productHandles.map((handle) => ({ url: `${SITE_URL}/products/${handle}`, changeFrequency: "weekly" as const, priority: 0.7 })),
  ];
}
