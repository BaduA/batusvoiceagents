import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@vap/core"],
  serverExternalPackages: ["@electric-sql/pglite"],
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
