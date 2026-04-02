import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Trail Account",
  description: "Trail account and API",
  icons: {
    icon: [
      {
        url: "/brand/trail-fork-light.svg",
        media: "(prefers-color-scheme: light)",
      },
      {
        url: "/brand/trail-fork-dark.svg",
        media: "(prefers-color-scheme: dark)",
      },
    ],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" data-theme="system" suppressHydrationWarning>
      <body className="min-h-screen bg-background text-foreground">
        {children}
      </body>
    </html>
  );
}
