import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { marketingCopy } from "@trail/content";
import { RevealObserver } from "./components/RevealObserver";
import { VideoObserver } from "./components/VideoObserver";
import {
  defaultDescription,
  defaultTitle,
  metadataBase
} from "../lib/seo";

const posterUrl = new URL("/assets/video-poster-white.jpg", metadataBase).toString();
const videoUrl = new URL("/assets/showcase.mp4", metadataBase).toString();

const videoSchema = {
  "@context": "https://schema.org",
  "@type": "VideoObject",
  name: "Trail product demo",
  description: "A quick tour of capture, curate, and share in under a minute.",
  thumbnailUrl: posterUrl,
  uploadDate: "2026-01-31T00:00:00Z",
  duration: "PT1M",
  contentUrl: videoUrl
};

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-sans",
  weight: ["300", "400", "500", "600", "700"]
});

export const metadata: Metadata = {
  metadataBase,
  title: defaultTitle,
  description: defaultDescription,
  alternates: {
    canonical: "/"
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
        alt: "Trail product overview"
      }
    ]
  },
  twitter: {
    card: "summary_large_image",
    title: defaultTitle,
    description: defaultDescription,
    images: ["/assets/video-poster-white.jpg"]
  },
  icons: {
    icon: [
      { url: "/assets/brand/trail-fork-light.svg", media: "(prefers-color-scheme: light)" },
      { url: "/assets/brand/trail-fork-dark.svg", media: "(prefers-color-scheme: dark)" }
    ]
  }
};

export default function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" data-theme="system" data-reveal-ready="true" className={jakarta.variable}>
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(videoSchema) }}
        />
      </head>
      <body className="bg-bg text-ink">
        {children}
        <RevealObserver />
        <VideoObserver />
      </body>
    </html>
  );
}
