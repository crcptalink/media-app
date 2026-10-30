import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: ["@prisma/client", "bcryptjs", "nodemailer"],
  poweredByHeader: false,
  // Church PC: Core i3-550, ~2.6 GiB free. One compile worker so `next build`
  // stays inside NODE_OPTIONS=--max-old-space-size=1536 (set in the Dockerfile).
  experimental: {
    cpus: 1,
    workerThreads: false,
    memoryBasedWorkersCount: true,
    staticGenerationMaxConcurrency: 1,
  },
  webpack: (config) => {
    config.parallelism = 1;
    return config;
  },
  async headers() {
    return [
      {
        source: "/_next/static/:path*",
        headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
      },
      {
        source: "/:file(.*\\.(?:png|jpg|jpeg|webp|svg|ico|gif))",
        headers: [{ key: "Cache-Control", value: "public, max-age=86400" }],
      },
    ];
  },
};

export default nextConfig;
