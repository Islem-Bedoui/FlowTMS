import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* Add/keep other Next.js config options above this line */
  eslint: {
    // Allow production builds to complete even if ESLint reports errors.
    ignoreDuringBuilds: true,
  },
  typescript: {
    // Allow production builds to complete even if TypeScript errors are present.
    ignoreBuildErrors: true,
  }
};

export default nextConfig;
