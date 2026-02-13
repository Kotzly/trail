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
    "@trail/ui",
    "@trail/content",
    "@trail/trpc",
    "@trail/db",
  ],
  serverExternalPackages: ["@prisma/client", "prisma"],
};

export default nextConfig;
