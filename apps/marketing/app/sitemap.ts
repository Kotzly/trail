import type { MetadataRoute } from "next";
import { resolveSiteUrl } from "../lib/seo";
import { fetchPageUpdatedAt, fetchSiteSettings } from "../lib/sanity/queries";

// Sitemap stays en-only until Russian content exists in Sanity. Once
// landingPage/supportPage have ru variants, emit each URL with
// `alternates.languages` entries pointing at the locale-prefixed paths
// (e.g. `${siteUrl}/ru`, `${siteUrl}/ru/support`) and keep `x-default` on
// English. Emitting hreflang=ru before translations land would signal
// duplicate content to search engines.

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
