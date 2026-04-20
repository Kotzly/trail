import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Geist, Geist_Mono } from "next/font/google";
import { Instrument_Serif } from "next/font/google";
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
import { Header } from "@/app/components/Header";
import { Footer } from "@/app/components/Footer";
import { fetchSiteSettings } from "@/lib/sanity/queries";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { JsonLd } from "@/app/components/JsonLd";
import { FeedbackWidget } from "@/app/components/FeedbackWidget";
import { routing } from "@/i18n/routing";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});
const instrumentSerif = Instrument_Serif({
  variable: "--font-instrument-serif",
  subsets: ["latin"],
  weight: "400",
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

  return (
    <html
      lang={locale}
      className={`dark ${geistSans.variable} ${geistMono.variable} ${instrumentSerif.variable}`}
    >
      <body className="antialiased">
        <NextIntlClientProvider locale={locale} messages={messages}>
          <JsonLd
            siteName={settings?.siteName}
            siteUrl={siteUrl}
            description={settings?.defaultSeo?.description}
            supportEmail={settings?.supportEmail}
            installUrl={settings?.navCta?.href}
          />
          <div className="relative z-10 min-h-screen flex flex-col">
            <Header
              navLinks={settings?.nav}
              ctaText={settings?.navCta?.text}
              ctaHref={settings?.navCta?.href}
            />
            <main className="flex-1">{children}</main>
            <Footer
              links={settings?.footerLinks}
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
