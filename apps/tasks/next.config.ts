import type { NextConfig } from "next";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { standardSecurityHeaders } from "./lib/security-headers";

const monorepoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);

const nextConfig: NextConfig = {
  // The development toolbar overlaps controls at the bottom of task modals.
  devIndicators: false,
  turbopack: {
    root: monorepoRoot,
  },
  outputFileTracingIncludes: {
    "/*": ["./changelog/**/*.md"],
  },
  transpilePackages: [
    "@ryanmeetup/brand",
    "@ryanmeetup/hooks",
    "@ryanmeetup/reviews",
    "@ryanmeetup/ui",
    "@ryanmeetup/utils",
  ],
  // Owner-only tools moved under /admin; keep bookmarks and shared
  // access-group links working.
  async redirects() {
    return [
      { source: "/access", destination: "/admin/access", permanent: true },
      {
        source: "/access/:slug",
        destination: "/admin/access/:slug",
        permanent: true,
      },
      { source: "/usage", destination: "/admin/usage", permanent: true },
      // Store reviews left /admin for its own sidebar entry.
      {
        source: "/admin/reviews",
        destination: "/store-reviews",
        permanent: true,
      },
    ];
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          ...standardSecurityHeaders,
          {
            key: "X-Robots-Tag",
            value: "noindex, nofollow, noarchive, nosnippet, noimageindex",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
