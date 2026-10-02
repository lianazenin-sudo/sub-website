import type { NextConfig } from "next";
import path from "node:path";

const monorepoRoot = path.join(__dirname, "../..");

const nextConfig: NextConfig = {
  // Monorepo: lockfile and shared node_modules live at the workspace root.
  outputFileTracingRoot: monorepoRoot,
  turbopack: {
    root: monorepoRoot,
  },
};

export default nextConfig;
