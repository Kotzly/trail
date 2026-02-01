import { Analytics } from "@vercel/analytics/next";
import { Suspense } from "react";
import { BackgroundArt } from "@trail/ui";
import { CallToAction } from "./components/CallToAction";
import { MarketingFooter } from "./components/MarketingFooter";
import { MarketingHero } from "./components/MarketingHero";
import { MarketingNav } from "./components/MarketingNav";
import { Showcase } from "./components/Showcase";
import { BentoFeatures } from "./components/sections/BentoFeatures";
import { FAQSection } from "./components/sections/FAQSection";
import { PersonalizationSection } from "./components/sections/PersonalizationSection";
import { PricingSection } from "./components/sections/PricingSection";
import { TestimonialsSection } from "./components/sections/TestimonialsSection";
import { HomeLoading } from "./components/page-wrapper";
import { buildMetadata } from "../lib/seo";

export const metadata = buildMetadata({
  title: "Trail — Privacy-first research trails",
  description:
    "Capture sources, notes, and decisions as you browse. Trail turns tab chaos into organized research trails you can share without storing page content.",
  path: "/",
});

export default function HomePage() {
  return (
    <Suspense fallback={<HomeLoading />}>
      <div className="min-h-screen bg-base text-ink">
        <MarketingNav />
        <main className="relative overflow-hidden">
          <BackgroundArt variant="grid" className="opacity-70" />
          <div className="relative">
            <MarketingHero />
            <Showcase />
            <BentoFeatures />
            <PersonalizationSection />
            <TestimonialsSection />
            <PricingSection />
            <FAQSection />
            <CallToAction />
          </div>
        </main>
        <MarketingFooter />
        <Analytics />
      </div>
    </Suspense>
  );
}
