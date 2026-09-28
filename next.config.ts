import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Source files are read at request time by the /api/reconcile route.
  outputFileTracingIncludes: {
    "/*": ["./data/**/*"],
  },
};

export default nextConfig;
