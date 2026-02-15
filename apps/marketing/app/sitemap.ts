import type { MetadataRoute } from "next";

const SITE_URL = "https://gettrail.net";

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();
  const routes = [
    "",
    "/about",
    "/contact",
    "/pricing",
    "/faq",
    "/support",
    "/downloads",
    "/privacy",
    "/terms",
  ];

  return routes.map((path) => ({
    url: `${SITE_URL}${path}`,
    lastModified,
    changeFrequency: "monthly",
    priority: path === "" ? 1 : 0.7,
  }));
}
