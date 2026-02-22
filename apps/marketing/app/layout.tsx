import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Instrument_Serif } from "next/font/google";
import "./globals.css";
import { defaultDescription, defaultTitle, metadataBase } from "../lib/seo";
import { Header } from "./components/Header";
import { Footer } from "./components/Footer";
import { fetchSiteSettings } from "../lib/sanity/queries";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });
const instrumentSerif = Instrument_Serif({
  variable: "--font-instrument-serif",
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
});

export const metadata: Metadata = {
  metadataBase,
  title: defaultTitle,
  description: defaultDescription,
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: defaultTitle,
    description: defaultDescription,
    url: "/",
    siteName: "Trail",
    type: "website",
    images: [
      {
        url: "/assets/video-poster-white.jpg",
        width: 1200,
        height: 630,
        alt: "Trail product overview",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: defaultTitle,
    description: defaultDescription,
    images: ["/assets/video-poster-white.jpg"],
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

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const settings = await fetchSiteSettings();

  return (
    <html
      lang="en"
      className={`dark ${geistSans.variable} ${geistMono.variable} ${instrumentSerif.variable}`}
    >
      <body className="antialiased">
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
        <div className="noise" aria-hidden="true" />
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
