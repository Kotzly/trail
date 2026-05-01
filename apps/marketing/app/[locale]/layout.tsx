import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Geist, Geist_Mono, Spectral } from "next/font/google";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getMessages, setRequestLocale } from "next-intl/server";
import "@/app/globals.css";
import {
  buildRobots,
  defaultDescription,
  defaultKeywords,
  SITE_NAME,
  defaultTitle,
  resolveSiteUrl,
  resolveOgImage,
  resolveOgLocale,
} from "@/lib/seo";
import { fetchSiteSettings } from "@/lib/sanity/queries";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { JsonLd } from "@/app/components/JsonLd";
import dynamic from "next/dynamic";
import { LandingNav, type NavLink } from "@/app/components/landing/Nav";
import { LandingFooter } from "@/app/components/landing/Footer";
import { INSTALL_URL } from "@/lib/install-url";
import { routing } from "@/i18n/routing";

// Below-the-fold floating button — defer its motion + lucide-react chunks
// until the rest of the page paints. `ssr: false` isn't permitted from a
// server component in Next 16, so leave SSR on; the win comes from the
// hydration-time chunk being its own bundle separate from the layout.
const FeedbackWidget = dynamic(() =>
  import("@/app/components/FeedbackWidget").then((m) => ({
    default: m.FeedbackWidget,
  })),
);

const FALLBACK_NAV_LINKS: NavLink[] = [
  { label: "Features", href: "/#features" },
  { label: "Try it", href: "/#try" },
];

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});
const spectral = Spectral({
  variable: "--font-spectral",
  subsets: ["latin"],
  weight: ["400", "500"],
  style: ["normal", "italic"],
});

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

type LayoutParams = Promise<{ locale: string }>;

export async function generateMetadata({
  params,
}: {
  params: LayoutParams;
}): Promise<Metadata> {
  const { locale } = await params;
  const settings = await fetchSiteSettings(locale);
  const siteName = settings?.siteName?.trim() || SITE_NAME;
  const siteUrl = resolveSiteUrl(settings?.siteUrl);
  const title = settings?.defaultSeo?.title?.trim() || defaultTitle;
  const description =
    settings?.defaultSeo?.description?.trim() || defaultDescription;
  const image = resolveOgImage(settings?.defaultSeo?.ogImage);

  return {
    metadataBase: new URL(siteUrl),
    applicationName: siteName,
    title: {
      default: title,
      template: `%s | ${siteName}`,
    },
    description,
    keywords: defaultKeywords,
    robots: buildRobots(),
    formatDetection: {
      email: false,
      address: false,
      telephone: false,
    },
    alternates: {
      canonical: "/",
    },
    openGraph: {
      title,
      description,
      url: "/",
      siteName,
      locale: resolveOgLocale(locale),
      type: "website",
      images: [image],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [image.url],
    },
    icons: {
      icon: [
        {
          url: "/assets/brand/trail-fork-light.svg",
          media: "(prefers-color-scheme: light)",
        },
        {
          url: "/assets/brand/trail-fork-dark.svg",
          media: "(prefers-color-scheme: dark)",
        },
      ],
    },
  };
}

export default async function RootLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: LayoutParams;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }
  setRequestLocale(locale);

  const [settings, messages] = await Promise.all([
    fetchSiteSettings(locale),
    getMessages(),
  ]);
  const siteUrl = resolveSiteUrl(settings?.siteUrl);
  const navLinks: NavLink[] = settings?.nav?.length
    ? settings.nav
    : FALLBACK_NAV_LINKS;
  const ctaText = settings?.navCta?.text ?? "Add to Chrome";
  const ctaHref = settings?.navCta?.href ?? INSTALL_URL;

  return (
    <html
      lang={locale}
      className={`dark ${geistSans.variable} ${geistMono.variable} ${spectral.variable}`}
    >
      <head>
        <link rel="preconnect" href="https://cdn.sanity.io" crossOrigin="" />
        <link rel="dns-prefetch" href="https://cdn.sanity.io" />
        <link
          rel="preload"
          as="image"
          type="image/webp"
          href="/landing/hero-poster.webp"
          fetchPriority="high"
        />
      </head>
      <body className="antialiased">
        <NextIntlClientProvider locale={locale} messages={messages}>
          <JsonLd
            siteName={settings?.siteName}
            siteUrl={siteUrl}
            description={settings?.defaultSeo?.description}
            supportEmail={settings?.supportEmail}
            installUrl={settings?.navCta?.href ?? INSTALL_URL}
          />
          <div className="relative z-10 min-h-screen flex flex-col">
            <LandingNav links={navLinks} ctaText={ctaText} ctaHref={ctaHref} />
            <main className="flex-1">{children}</main>
            <LandingFooter
              contactEmail={settings?.supportEmail}
              copyright={settings?.footerCopyright}
            />
          </div>
          <FeedbackWidget />
          <div className="noise" aria-hidden="true" />
        </NextIntlClientProvider>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
