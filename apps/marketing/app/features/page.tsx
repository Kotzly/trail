import { Metadata } from "next";
import { BackgroundArt } from "@trail/ui";
import { MarketingFooter } from "../components/MarketingFooter";
import { MarketingNav } from "../components/MarketingNav";
import { FeaturesHero } from "./FeaturesHero";
import { FeaturesGrid } from "./FeaturesGrid";
import { FeaturesTimeline } from "./FeaturesTimeline";
import { FeaturesCTA } from "./FeaturesCTA";

export const metadata: Metadata = {
  title: "Features · Trail",
  description: "Everything you need for better research. One-click capture, instant search, visual pathways, and more.",
};

export default function FeaturesPage() {
  return (
    <div className="min-h-screen bg-base text-ink">
      <MarketingNav />
      <main className="relative overflow-hidden">
        <BackgroundArt variant="grid" className="opacity-50" />
        
        <FeaturesHero />
        <FeaturesGrid />
        
        {/* Integration Section */}
        <section className="relative px-6 py-16">
          <div className="mx-auto max-w-4xl">
            <div className="rounded-3xl border border-stroke/40 bg-surface/50 p-8 md:p-12 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-accent/10">
                <svg className="h-7 w-7 text-accent" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="3" width="18" height="18" rx="2" />
                  <path d="M3 9h18M9 21V9" />
                </svg>
              </div>
              <h2 className="mt-6 text-2xl font-semibold text-ink">Works where you work</h2>
              <p className="mx-auto mt-3 max-w-lg text-ink-muted">
                Trail integrates seamlessly with your browser. No extensions to manage, 
                no accounts to configure. Just install and start researching.
              </p>
              <div className="mt-8 flex flex-wrap justify-center gap-3">
                {["Chrome", "Edge", "Brave", "Firefox (soon)"].map((browser) => (
                  <span 
                    key={browser}
                    className="rounded-full border border-stroke/60 bg-surface px-4 py-2 text-sm text-ink-muted"
                  >
                    {browser}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </section>

        <FeaturesTimeline />
        <FeaturesCTA />
      </main>
      <MarketingFooter />
    </div>
  );
}
