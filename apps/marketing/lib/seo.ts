import type { Metadata } from "next";

const SITE_URL = "https://gettrail.net";
const FALLBACK_OG_IMAGE = "/assets/og-default.png";

export const defaultTitle = "Trail – Visualized Browsing";
export const defaultDescription =
  "Capture sources, notes, and decisions as you browse. Trail turns tab chaos into organized research trails you can share without storing page content.";

type SanityImage = {
  asset?: { url?: string; metadata?: { dimensions?: { width?: number; height?: number } } };
} | null;

type MetadataInput = {
  title: string;
  description: string;
  path: string;
  ogImage?: SanityImage;
};

function resolveOgImage(image?: SanityImage) {
  if (image?.asset?.url) {
    const dims = image.asset.metadata?.dimensions;
    return {
      url: image.asset.url,
      width: dims?.width ?? 1200,
      height: dims?.height ?? 630,
      alt: "Trail product overview",
    };
  }
  return {
    url: FALLBACK_OG_IMAGE,
    width: 1200,
    height: 630,
    alt: "Trail product overview",
  };
}

export function buildMetadata({
  title,
  description,
  path,
  ogImage,
}: MetadataInput): Metadata {
  const image = resolveOgImage(ogImage);
  return {
    title,
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
      images: [image],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [image.url],
    },
  };
}

export { resolveOgImage, FALLBACK_OG_IMAGE };
export const metadataBase = new URL(SITE_URL);
