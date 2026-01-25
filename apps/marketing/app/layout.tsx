import type { Metadata } from "next";
import "./globals.css";
import { marketingCopy } from "@trail/content";

export const metadata: Metadata = {
  title: marketingCopy.meta.title,
  description: marketingCopy.meta.description
};

export default function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" data-theme="system">
      <body className="bg-bg text-ink">
        {children}
      </body>
    </html>
  );
}
