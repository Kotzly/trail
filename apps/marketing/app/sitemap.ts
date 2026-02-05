import type { MetadataRoute } from "next";
import { publicEnv } from "@/lib/public-env";

const siteUrl = publicEnv.NEXT_PUBLIC_SITE_URL;

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
    url: `${siteUrl}${path}`,
    lastModified,
    changeFrequency: "monthly",
    priority: path === "" ? 1 : 0.7,
  }));
}
