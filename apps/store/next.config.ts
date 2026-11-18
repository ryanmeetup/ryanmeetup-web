import type { NextConfig } from "next";
import { reviewPhotoHosts } from "./lib/review-photo-hosts";

const nextConfig: NextConfig = {
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
  images: {
    remotePatterns: [
      ...reviewPhotoHosts.map((hostname) => ({ protocol: "https" as const, hostname })),
      { protocol: "https", hostname: "cdn.shopify.com" },
      { protocol: "https", hostname: "images.unsplash.com" },
    ],
  },
};

export default nextConfig;
