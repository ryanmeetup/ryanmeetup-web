import type { MetadataRoute } from "next";
import { getCollections, getPolicies, getProductHandles } from "@/lib/shopify";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://store.ryanmeetup.com";
  const [collections, productHandles, policies] = await Promise.all([getCollections(), getProductHandles(), getPolicies()]);
  return [
    { url: baseUrl, changeFrequency: "weekly", priority: 1 },
    { url: `${baseUrl}/about`, changeFrequency: "monthly", priority: 0.6 },
    { url: `${baseUrl}/contact`, changeFrequency: "monthly", priority: 0.6 },
    ...collections.map((collection) => ({ url: `${baseUrl}/collections/${collection.handle}`, changeFrequency: "daily" as const, priority: 0.8 })),
    ...policies.map((policy) => ({ url: `${baseUrl}/policies/${policy.handle}`, changeFrequency: "yearly" as const, priority: 0.3 })),
    ...productHandles.map((handle) => ({ url: `${baseUrl}/products/${handle}`, changeFrequency: "weekly" as const, priority: 0.7 })),
  ];
}
