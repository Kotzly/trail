import type { Metadata } from "next";
import { Fraunces, Instrument_Sans } from "next/font/google";
import "./globals.css";
import { accountCopy } from "@trail/content";
import { Providers } from "./providers";

const display = Fraunces({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-display",
  weight: ["400", "500", "600", "700"]
});

const sans = Instrument_Sans({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-sans",
  weight: ["400", "500", "600", "700"]
});

export const metadata: Metadata = {
  title: accountCopy.meta.title,
  description: accountCopy.meta.description,
  icons: {
    icon: [
      { url: "/brand/trail-fork-light.svg", media: "(prefers-color-scheme: light)" },
      { url: "/brand/trail-fork-dark.svg", media: "(prefers-color-scheme: dark)" }
    ]
  }
};

export default function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      data-theme="system"
      suppressHydrationWarning
      className={`${display.variable} ${sans.variable}`}
    >
      <body className="bg-bg text-ink">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
