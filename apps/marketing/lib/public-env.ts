/**
 * NEXT_PUBLIC_APP_URL is injected by next.config.mjs at build time.
 * It auto-derives from VERCEL_BRANCH_URL on preview deployments and
 * falls back to the production canonical URL.
 */
const nextPublicAppUrl =
  process.env.NEXT_PUBLIC_APP_URL || "https://app.gettrail.net";

export const publicEnv = {
  NEXT_PUBLIC_APP_URL: nextPublicAppUrl,
};
