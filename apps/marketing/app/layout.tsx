import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Instrument_Serif } from "next/font/google";
import "./globals.css";
import {
  buildRobots,
  defaultDescription,
  defaultKeywords,
  SITE_NAME,
  defaultTitle,
  resolveSiteUrl,
  resolveOgImage,
} from "../lib/seo";
import { Header } from "./components/Header";
import { Footer } from "./components/Footer";
import { fetchSiteSettings } from "../lib/sanity/queries";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { JsonLd } from "./components/JsonLd";
import { FeedbackWidget } from "./components/FeedbackWidget";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });
const instrumentSerif = Instrument_Serif({
  variable: "--font-instrument-serif",
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
});

export async function generateMetadata(): Promise<Metadata> {
  const settings = await fetchSiteSettings();
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
      locale: "en_US",
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
}: {
  children: React.ReactNode;
}) {
  const settings = await fetchSiteSettings();
  const siteUrl = resolveSiteUrl(settings?.siteUrl);

  return (
    <html
      lang="en"
      className={`dark ${geistSans.variable} ${geistMono.variable} ${instrumentSerif.variable}`}
    >
      <body className="antialiased">
        <JsonLd
          siteName={settings?.siteName}
          siteUrl={siteUrl}
          description={settings?.defaultSeo?.description}
          supportEmail={settings?.supportEmail}
          installUrl={settings?.navCta?.href}
        />
        <div className="min-h-screen flex flex-col">
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
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
