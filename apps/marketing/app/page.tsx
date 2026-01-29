import { Analytics } from "@vercel/analytics/next";
import { BackgroundArt } from "@trail/ui";
import { CallToAction } from "./components/CallToAction";
import { FeatureGrid } from "./components/FeatureGrid";
import { HowItWorks } from "./components/HowItWorks";
import { MarketingFooter } from "./components/MarketingFooter";
import { MarketingHero } from "./components/MarketingHero";
import { MarketingNav } from "./components/MarketingNav";
import { Showcase } from "./components/Showcase";
import { TestimonialsCarousel } from "./components/TestimonialsCarousel";

export default function HomePage() {
  return (
    <div className="min-h-screen bg-base text-ink">
      <MarketingNav />
      <main className="relative overflow-hidden">
        <BackgroundArt variant="grid" className="opacity-70" />
        <div className="relative">
          <MarketingHero />
          <TestimonialsCarousel />
          <Showcase />
          <FeatureGrid />
          <HowItWorks />
          <CallToAction />
        </div>
      </main>
      <MarketingFooter />
      <Analytics />
    </div>
  );
}
