import { Analytics } from "@vercel/analytics/next";
import { Suspense } from "react";
import { BackgroundArt } from "@trail/ui";
import { MarketingFooter } from "./components/MarketingFooter";
import { MarketingNav } from "./components/MarketingNav";
import { Showcase } from "./components/Showcase";
import { BentoFeatures } from "./components/sections/BentoFeatures";
import { FAQSection } from "./components/sections/FAQSection";
import { PersonalizationSection } from "./components/sections/PersonalizationSection";
import { PricingSection } from "./components/sections/PricingSection";
import { TestimonialsSection } from "./components/sections/TestimonialsSection";
import { HeroDitheringCard } from "./components/ui/hero-dithering-card";
import { CallToAction } from "./components/CallToAction";
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
            <HeroDitheringCard
              eyebrow="Browser app · free beta"
              title="Turn browsing into"
              rotatingWords={["shareable paths", "clear decisions", "organized research", "team context", "calm workflows"]}
              description="Capture every meaningful step, add notes when it matters, and share a clean research path instead of a tab dump."
              ctaText="Get the extension"
              ctaHref="/downloads"
              secondaryCtaText="See the 60s demo"
              secondaryCtaHref="/#showcase"
              showStats={true}
            />
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
