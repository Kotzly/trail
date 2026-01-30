import type { Metadata } from "next";
import "./globals.css";
import { marketingCopy } from "@trail/content";
import { RevealObserver } from "./components/RevealObserver";
import { VideoObserver } from "./components/VideoObserver";

export const metadata: Metadata = {
  title: marketingCopy.meta.title,
  description: marketingCopy.meta.description,
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
    <html lang="en" data-theme="system" data-reveal-ready="true">
      <body className="bg-bg text-ink">
        {children}
        <RevealObserver />
        <VideoObserver />
      </body>
    </html>
  );
}
