import { CallToAction } from "./components/CallToAction";
import { FeatureGrid } from "./components/FeatureGrid";
import { HowItWorks } from "./components/HowItWorks";
import { MarketingFooter } from "./components/MarketingFooter";
import { MarketingHero } from "./components/MarketingHero";
import { MarketingNav } from "./components/MarketingNav";
import { SecuritySection } from "./components/SecuritySection";

export default function HomePage() {
  return (
    <div className="min-h-screen bg-bg text-ink">
      <MarketingNav />
      <main>
        <MarketingHero />
        <FeatureGrid />
        <HowItWorks />
        <SecuritySection />
        <CallToAction />
      </main>
      <MarketingFooter />
    </div>
  );
}
