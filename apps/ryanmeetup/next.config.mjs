/** @type {import('next').NextConfig} */
const nextConfig = {
  // Playwright builds into its own directory so an e2e run never disturbs the
  // `.next` a dev server is using.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  transpilePackages: ["@ryanmeetup/hooks", "@ryanmeetup/metadata", "@ryanmeetup/ui"],
  // Membership cards moved to /ryd, and merch moved from Etsy to the store;
  // keep printed and shared links working.
  async redirects() {
    return [
      { source: "/merch", destination: "https://store.ryanmeetup.com/", permanent: true },
      { source: "/cards", destination: "/ryd", permanent: true },
      { source: "/cards/:path*", destination: "/ryd/:path*", permanent: true },
    ];
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.ctfassets.net",
        port: "",
      },
      {
        protocol: "https",
        hostname: "downloads.ctfassets.net",
        port: "",
      },
      {
        protocol: "https",
        hostname: "js.stripe.com",
        port: "",
      },
      {
        protocol: "https",
        hostname: "play-lh.googleusercontent.com",
        port: "",
      },
      {
        protocol: "https",
        hostname: "cdn.shopify.com",
        port: "",
      },
    ],
  },
};

export default nextConfig;
