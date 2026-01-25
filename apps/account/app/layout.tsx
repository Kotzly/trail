import type { Metadata } from "next";
import "./globals.css";
import { accountCopy } from "@trail/content";
import { Providers } from "./providers";

export const metadata: Metadata = {
  title: accountCopy.meta.title,
  description: accountCopy.meta.description
};

export default function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" data-theme="system" suppressHydrationWarning>
      <body className="bg-bg text-ink">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
