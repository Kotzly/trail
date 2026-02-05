import type { Metadata } from "next";

const defaultSiteUrl =
  process.env.NODE_ENV === "production"
    ? "https://gettrail.net"
    : "http://localhost:3000";
const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : defaultSiteUrl);
const ogImage = "/assets/video-poster-white.jpg";

export const defaultTitle = "Trail – Visualized Browsing";
export const defaultDescription =
  "Capture sources, notes, and decisions as you browse. Trail turns tab chaos into organized research trails you can share without storing page content.";

type MetadataInput = {
  title: string;
  description: string;
  path: string;
};

export function buildMetadata({
  title,
  description,
  path,
}: MetadataInput): Metadata {
  return {
    title: {
      absolute: title,
    },
    description,
    alternates: {
      canonical: path,
    },
    openGraph: {
      title,
      description,
      url: path,
      siteName: "Trail",
      type: "website",
      images: [
        {
          url: ogImage,
          width: 1200,
          height: 630,
          alt: "Trail product overview",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [ogImage],
    },
  };
}

export const metadataBase = new URL(siteUrl);
