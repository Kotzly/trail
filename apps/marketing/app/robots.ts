import type { MetadataRoute } from "next";
import { resolveSiteUrl } from "../lib/seo";
import { fetchSiteSettings } from "../lib/sanity/queries";

function isProductionDeploy() {
  if (process.env.VERCEL_ENV) {
    return process.env.VERCEL_ENV === "production";
  }

  return process.env.NODE_ENV === "production";
}

export default async function robots(): Promise<MetadataRoute.Robots> {
  const settings = await fetchSiteSettings();
  const siteUrl = resolveSiteUrl(settings?.siteUrl);

  if (!isProductionDeploy()) {
    return {
      rules: {
        userAgent: "*",
        disallow: "/",
      },
    };
  }

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/api", "/api/*"],
      },
    ],
    host: siteUrl,
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
