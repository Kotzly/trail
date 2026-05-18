import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

const FALLBACK_SITE_URL = "https://gettrail.net";
export const SITE_NAME = "Trail";
const FALLBACK_OG_IMAGE = "/assets/og-default.png";

const DEFAULT_TITLE_BY_LOCALE: Record<string, string> = {
  en: "Trail – Visualized Browsing",
  ru: "Trail — браузинг, который видно",
};
const DEFAULT_DESCRIPTION_BY_LOCALE: Record<string, string> = {
  en: "Capture sources, notes, and decisions as you browse. Trail turns tab chaos into organized research trails you can share without storing page content.",
  ru: "Сохраняйте источники, заметки и решения прямо во время серфинга. Trail превращает хаос вкладок в аккуратные ветви исследований — без хранения содержимого страниц.",
};

// Synchronous fallbacks for callers without locale context (e.g. sitemap).
export const defaultTitle = DEFAULT_TITLE_BY_LOCALE.en!;
export const defaultDescription = DEFAULT_DESCRIPTION_BY_LOCALE.en!;

export async function resolveDefaultTitle(locale?: string) {
  if (!locale) return defaultTitle;
  try {
    const t = await getTranslations({ locale, namespace: "seo" });
    return t("defaultTitle");
  } catch {
    return DEFAULT_TITLE_BY_LOCALE[locale] ?? defaultTitle;
  }
}

export async function resolveDefaultDescription(locale?: string) {
  if (!locale) return defaultDescription;
  try {
    const t = await getTranslations({ locale, namespace: "seo" });
    return t("defaultDescription");
  } catch {
    return DEFAULT_DESCRIPTION_BY_LOCALE[locale] ?? defaultDescription;
  }
}

export const defaultKeywords = [
  "research assistant",
  "browser extension",
  "knowledge management",
  "web research workflow",
  "source tracking",
  "research notes",
  "decision log",
];

type SanityImage = {
  asset?: {
    url?: string;
    metadata?: { dimensions?: { width?: number; height?: number } };
  };
} | null;

type MetadataInput = {
  title: string;
  description: string;
  path: string;
  ogImage?: SanityImage;
  keywords?: string[];
  absoluteTitle?: boolean;
  locale?: string;
};

export function resolveSiteUrl(siteUrl?: string | null): string {
  const trimmed = siteUrl?.trim();
  if (!trimmed) return FALLBACK_SITE_URL;
  return trimmed.endsWith("/") ? trimmed.slice(0, -1) : trimmed;
}

const OG_LOCALE_MAP: Record<string, string> = {
  en: "en_US",
  ru: "ru_RU",
};

export function resolveOgLocale(locale: string): string {
  return OG_LOCALE_MAP[locale] ?? OG_LOCALE_MAP.en!;
}

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

function isIndexableEnvironment() {
  if (process.env.VERCEL_ENV) {
    return process.env.VERCEL_ENV === "production";
  }

  return process.env.NODE_ENV === "production";
}

export function buildRobots(
  indexable = isIndexableEnvironment(),
): NonNullable<Metadata["robots"]> {
  if (!indexable) {
    return {
      index: false,
      follow: false,
      googleBot: {
        index: false,
        follow: false,
        noimageindex: true,
      },
    };
  }

  return {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  };
}

export function buildMetadata({
  title,
  description,
  path,
  ogImage,
  keywords,
  absoluteTitle,
  locale,
}: MetadataInput): Metadata {
  const image = resolveOgImage(ogImage);
  return {
    title: absoluteTitle ? { absolute: title } : title,
    description,
    keywords: keywords ?? defaultKeywords,
    alternates: {
      canonical: path,
    },
    robots: buildRobots(),
    openGraph: {
      title,
      description,
      url: path,
      siteName: SITE_NAME,
      locale: resolveOgLocale(locale ?? "en"),
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
