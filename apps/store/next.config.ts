import type { NextConfig } from "next";
import { standardSecurityHeaders } from "@ryanmeetup/utils";
import { reviewPhotoHosts } from "./lib/review-photo-hosts";

/**
 * Buyer sign-in is tested locally through an HTTPS tunnel, whose host is the
 * one registered as the Shopify callback. `next dev` serves its dev assets to
 * that host too; this setting has no effect outside development.
 */
function tunnelHost() {
  try {
    const url = new URL(process.env.SHOPIFY_CUSTOMER_ACCOUNT_REDIRECT_URI ?? "");
    return url.hostname && url.hostname !== "localhost" ? [url.hostname] : [];
  } catch {
    return [];
  }
}

const nextConfig: NextConfig = {
  // Playwright builds into its own directory so it can run beside `next dev`.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  allowedDevOrigins: tunnelHost(),
  transpilePackages: ["@ryanmeetup/contact", "@ryanmeetup/hooks", "@ryanmeetup/metadata", "@ryanmeetup/reviews", "@ryanmeetup/ui", "@ryanmeetup/utils"],
  // Garment collections retired in Shopify now live as garment pages under their
  // department, and the departments moved from /collections to the top level.
  async redirects() {
    return [
      { source: "/collections/hats", destination: "/apparel/hats", permanent: true },
      { source: "/collections/hoodies", destination: "/apparel/hoodies", permanent: true },
      { source: "/collections/youth", destination: "/apparel/kids", permanent: true },
      { source: "/collections/toddler", destination: "/apparel/kids", permanent: true },
      { source: "/collections/flags", destination: "/accessories/flags", permanent: true },
      { source: "/accessories/home", destination: "/accessories/home-goods", permanent: true },
      { source: "/accessories/ryd", destination: "/collections/ryd", permanent: true },
      { source: "/collections/:department(apparel|accessories)/:garment*", destination: "/:department/:garment*", permanent: true },
    ];
  },
  async headers() {
    return [
      { source: "/:path*", headers: [...standardSecurityHeaders] },
      // Keep the private photo policy after the site default: matching config
      // headers can override a route handler's response header.
      { source: "/api/reviews/photos/:path*", headers: [{ key: "Referrer-Policy", value: "no-referrer" }] },
    ];
  },
  images: {
    remotePatterns: [
      ...reviewPhotoHosts.map((hostname) => ({ protocol: "https" as const, hostname })),
      { protocol: "https", hostname: "cdn.shopify.com" },
      // Demo catalog photos only; a connected store never optimizes Unsplash images.
      ...(process.env.SHOPIFY_STORE_DOMAIN && process.env.SHOPIFY_STOREFRONT_API_TOKEN ? [] : [{ protocol: "https" as const, hostname: "images.unsplash.com" }]),
    ],
  },
};

export default nextConfig;
