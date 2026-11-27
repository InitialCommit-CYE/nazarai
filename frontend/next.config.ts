import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  // /api/screen reads the bundled sample photos from disk instead of having the browser upload them.
  outputFileTracingIncludes: {
    "/api/screen": ["./public/demo/*.jpg"],
  },
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
