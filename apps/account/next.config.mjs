import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import createNextIntlPlugin from "next-intl/plugin";

const __dirname = dirname(fileURLToPath(import.meta.url));

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  turbopack: {
    root: join(__dirname, "../.."),
  },
  transpilePackages: [
    "@trail/content",
    "@trail/auth-token",
    "@trail/db",
  ],
  serverExternalPackages: ["@prisma/client", "prisma"],
  allowedDevOrigins: ["http://100.123.146.112:4001"],
};

export default withNextIntl(nextConfig);
