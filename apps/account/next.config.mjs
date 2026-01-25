/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@trail/ui", "@trail/content", "@trail/trpc", "@trail/db"]
};

export default nextConfig;
