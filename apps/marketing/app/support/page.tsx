import type { Metadata } from "next";

import { marketingCopy } from "@trail/content";
import { BackgroundArt } from "@trail/ui";

import { MarketingFooter } from "../components/MarketingFooter";
import { MarketingNav } from "../components/MarketingNav";
import { SupportFlow } from "./SupportFlow";

export const metadata: Metadata = {
  title: marketingCopy.support.meta.title,
  description: marketingCopy.support.meta.description,
};

export default function SupportPage() {
  return (
    <div className="min-h-screen bg-base text-ink">
      <MarketingNav />
      <main className="relative overflow-hidden">
        <BackgroundArt variant="signal" />
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -left-16 top-12 h-40 w-40 rounded-full bg-ink/5 blur-3xl float-slow" />
          <div className="absolute right-10 top-24 h-56 w-56 rounded-full bg-ink/10 blur-3xl float-slower" />
          <div className="absolute bottom-10 left-1/2 h-44 w-44 -translate-x-1/2 rounded-full bg-ink/5 blur-3xl float-slow" />
        </div>
        <SupportFlow />
      </main>
      <MarketingFooter />
    </div>
  );
}

