import type { MetadataRoute } from "next";
import { resolveSiteUrl } from "../lib/seo";
import { fetchPageUpdatedAt, fetchSiteSettings } from "../lib/sanity/queries";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [homeUpdatedAt, settings] = await Promise.all([
    fetchPageUpdatedAt("home"),
    fetchSiteSettings(),
  ]);
  const siteUrl = resolveSiteUrl(settings?.siteUrl);

  return [
    {
      url: siteUrl,
      lastModified: homeUpdatedAt ? new Date(homeUpdatedAt) : new Date(),
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: `${siteUrl}/privacy`,
      changeFrequency: "yearly",
      priority: 0.3,
    },
    {
      url: `${siteUrl}/terms`,
      changeFrequency: "yearly",
      priority: 0.3,
    },
    {
      url: `${siteUrl}/support`,
      changeFrequency: "monthly",
      priority: 0.5,
    },
  ];
}
