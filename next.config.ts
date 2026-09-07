import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: false,
  async rewrites() {
    return [
      {
        source: "/",
        destination: "/landing.html",
      },
      {
        source: "/landing",
        destination: "/landing.html",
      },
    ];
  },
};

export default nextConfig;
