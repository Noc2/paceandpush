import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@paceandpush/api-contracts", "@paceandpush/brand"],
};

export default nextConfig;
