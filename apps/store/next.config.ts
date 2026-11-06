import type { NextConfig } from "next";
import { reviewPhotoHosts } from "./lib/review-photo-hosts";

const nextConfig: NextConfig = {
  transpilePackages: ["@ryanmeetup/contact", "@ryanmeetup/hooks", "@ryanmeetup/metadata", "@ryanmeetup/ui", "@ryanmeetup/utils"],
  images: {
    remotePatterns: [
      ...reviewPhotoHosts.map((hostname) => ({ protocol: "https" as const, hostname })),
      { protocol: "https", hostname: "cdn.shopify.com" },
      { protocol: "https", hostname: "images.unsplash.com" },
    ],
  },
};

export default nextConfig;
