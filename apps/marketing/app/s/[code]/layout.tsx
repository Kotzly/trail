import type { Metadata } from "next";
import "@/app/globals.css";

/**
 * Minimal layout for the public shared-trail viewer. No marketing nav,
 * no footer chrome — the page is its own surface. Defaults `robots`
 * to `noindex,nofollow` so opaque share codes don't end up in Google's
 * index when posted to public forums (premortem #9). Per-page metadata
 * (title, OG) is generated dynamically below.
 */
export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
    googleBot: { index: false, follow: false, noimageindex: true },
  },
  referrer: "no-referrer",
};

export default function SharedTrailLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen bg-background text-foreground antialiased">
        {children}
      </body>
    </html>
  );
}
