const nextPublicAppUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
const nextPublicSiteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "";

const missing: string[] = [];
if (!nextPublicAppUrl) {
  missing.push("NEXT_PUBLIC_APP_URL");
}
if (!nextPublicSiteUrl) {
  missing.push("NEXT_PUBLIC_SITE_URL");
}

if (missing.length > 0) {
  throw new Error(`Missing environment variable(s): ${missing.join(", ")}`);
}

export const publicEnv = {
  NEXT_PUBLIC_APP_URL: nextPublicAppUrl,
  NEXT_PUBLIC_SITE_URL: nextPublicSiteUrl,
};
