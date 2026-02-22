import type { MetadataRoute } from "next";
import { fetchPageUpdatedAt } from "../lib/sanity/queries";

const SITE_URL = "https://gettrail.net";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const homeUpdatedAt = await fetchPageUpdatedAt("home");

  return [
    {
      url: SITE_URL,
      lastModified: homeUpdatedAt ? new Date(homeUpdatedAt) : new Date(),
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: `${SITE_URL}/privacy`,
      changeFrequency: "yearly",
      priority: 0.3,
    },
    {
      url: `${SITE_URL}/terms`,
      changeFrequency: "yearly",
      priority: 0.3,
    },
    {
      url: `${SITE_URL}/support`,
      changeFrequency: "monthly",
      priority: 0.5,
    },
  ];
}
