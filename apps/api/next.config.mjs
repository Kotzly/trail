/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@trail/trpc", "@trail/db"],
  serverExternalPackages: ["@prisma/client", "prisma"],
};

export default nextConfig;
