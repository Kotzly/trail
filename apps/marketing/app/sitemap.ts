import type { MetadataRoute } from "next";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL
  ?? (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null)
  ?? (process.env.NODE_ENV === "production" ? "https://gettrail.net" : "http://localhost:3000");

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
    "/terms"
  ];

  return routes.map((path) => ({
    url: `${siteUrl}${path}`,
    lastModified,
    changeFrequency: "monthly",
    priority: path === "" ? 1 : 0.7
  }));
}
