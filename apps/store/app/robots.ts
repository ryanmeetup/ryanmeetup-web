import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/metadata";

// Crawlers may fetch pages so they can read the beta noindex in each page's metadata.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/" },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
