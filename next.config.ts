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
};

export default nextConfig;
