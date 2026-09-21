import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  server: {
    host: "0.0.0.0",
    port: parseInt(process.env.PORT || "8080", 10),
  },
};

export default nextConfig;
