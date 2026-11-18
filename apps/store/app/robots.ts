import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/metadata";

// Public pages can be indexed; cart and account pages set their own noindex.
// Crawlers stay out of the API: following a review "Sign in" link would start
// a real sign-in, writing a record and calling Shopify on every visit.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: "/api/" },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
