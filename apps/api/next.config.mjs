/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@trail/trpc", "@trail/db"]
};

export default nextConfig;
