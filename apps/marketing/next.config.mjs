import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Derive NEXT_PUBLIC_APP_URL for Vercel preview deployments.
 *
 * On production → uses the explicit env var (https://app.gettrail.net).
 * On preview   → replaces the marketing project name in VERCEL_BRANCH_URL
 *                 with the account project name so links point to the
 *                 matching account preview.
 *
 * Set VERCEL_MARKETING_PROJECT / VERCEL_ACCOUNT_PROJECT env vars if your
 * Vercel project names differ from the defaults below.
 */
function resolveAppUrl() {
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL;

  const branchUrl = process.env.VERCEL_BRANCH_URL;
  if (branchUrl && process.env.VERCEL_ENV === "preview") {
    const marketingProject =
      process.env.VERCEL_MARKETING_PROJECT ?? "trail-marketing";
    const accountProject =
      process.env.VERCEL_ACCOUNT_PROJECT ?? "trail-account";
    return `https://${branchUrl.replace(marketingProject, accountProject)}`;
  }

  // Fallback: production canonical URL
  return "https://app.gettrail.net";
}

const appUrl = resolveAppUrl();

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  env: {
    NEXT_PUBLIC_APP_URL: appUrl,
  },
  turbopack: {
    root: join(__dirname, "../.."),
  },
  transpilePackages: [],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
    ],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
