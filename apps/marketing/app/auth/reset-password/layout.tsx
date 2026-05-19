import type { Metadata } from "next";
import "@/app/globals.css";

export const metadata: Metadata = {
  title: "Set a new password — Trail",
  robots: {
    index: false,
    follow: false,
    googleBot: { index: false, follow: false, noimageindex: true },
  },
};

export default function ResetPasswordLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen bg-background text-foreground antialiased">
        <main className="flex min-h-screen items-center justify-center px-6 py-12">
          <div className="w-full max-w-md">{children}</div>
        </main>
      </body>
    </html>
  );
}
