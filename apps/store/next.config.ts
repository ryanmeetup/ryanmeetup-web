import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@ryanmeetup/contact", "@ryanmeetup/hooks", "@ryanmeetup/ui"],
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "cdn.shopify.com" },
      { protocol: "https", hostname: "images.unsplash.com" },
    ],
  },
};

export default nextConfig;
