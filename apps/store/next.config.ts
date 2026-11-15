import type { NextConfig } from "next";
import { reviewPhotoHosts } from "./lib/review-photo-hosts";

const nextConfig: NextConfig = {
  transpilePackages: ["@ryanmeetup/contact", "@ryanmeetup/hooks", "@ryanmeetup/metadata", "@ryanmeetup/ui", "@ryanmeetup/utils"],
  // Garment collections retired in Shopify now live as garment pages under their department.
  async redirects() {
    return [
      { source: "/collections/hats", destination: "/collections/apparel/hats", permanent: true },
      { source: "/collections/hoodies", destination: "/collections/apparel/hoodies", permanent: true },
      { source: "/collections/youth", destination: "/collections/apparel/kids", permanent: true },
      { source: "/collections/toddler", destination: "/collections/apparel/kids", permanent: true },
      { source: "/collections/flags", destination: "/collections/accessories/flags", permanent: true },
    ];
  },
  images: {
    remotePatterns: [
      ...reviewPhotoHosts.map((hostname) => ({ protocol: "https" as const, hostname })),
      { protocol: "https", hostname: "cdn.shopify.com" },
      { protocol: "https", hostname: "images.unsplash.com" },
    ],
  },
};

export default nextConfig;
