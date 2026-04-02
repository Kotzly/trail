import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  turbopack: {
    root: join(__dirname, "../.."),
  },
  transpilePackages: [
    "@trail/content",
    "@trail/trpc",
    "@trail/db",
  ],
  serverExternalPackages: ["@prisma/client", "prisma"],
  allowedDevOrigins: ["http://100.123.146.112:4001"],
};

export default nextConfig;
