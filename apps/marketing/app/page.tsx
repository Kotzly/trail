import { Analytics } from "@vercel/analytics/next";
import { CallToAction } from "./components/CallToAction";
import { FeatureGrid } from "./components/FeatureGrid";
import { HowItWorks } from "./components/HowItWorks";
import { MarketingFooter } from "./components/MarketingFooter";
import { MarketingHero } from "./components/MarketingHero";
import { MarketingNav } from "./components/MarketingNav";
import { Showcase } from "./components/Showcase";

export default function HomePage() {
  return (
    <div className="min-h-screen bg-base text-ink">
      <MarketingNav />
      <main>
        <MarketingHero />
        <Showcase />
        <FeatureGrid />
        <HowItWorks />
        <CallToAction />
      </main>
      <MarketingFooter />
      <Analytics />
    </div>
  );
}
