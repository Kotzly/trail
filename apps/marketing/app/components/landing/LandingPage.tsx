"use client";

import { LandingNav } from "./Nav";
import { LandingHero } from "./Hero";
import { LandingFeatures } from "./Features";
import { LandingDemo } from "./Demo";
import { LandingCta } from "./Cta";
import { LandingFooter } from "./Footer";

export function LandingPage() {
  return (
    <div data-landing className="relative">
      <style jsx global>{`
        [data-landing] {
          --landing-bg: #0a0908;
          --landing-bg-2: #15110c;
          --landing-ink: #f6efe1;
          --landing-ink-2: #c5b89c;
          --landing-ink-3: #8e8270;
          --landing-ember: #f8d364;
          --landing-ember-2: #d1734e;
          --landing-ember-3: #d2345c;
          --landing-line: rgba(246, 239, 225, 0.1);
          --landing-line-strong: rgba(246, 239, 225, 0.22);
          background: var(--landing-bg);
          color: var(--landing-ink);
        }
        [data-landing] ::selection {
          background: var(--landing-ember);
          color: #1a1308;
        }
      `}</style>
      <LandingNav />
      <LandingHero />
      <LandingFeatures />
      <LandingDemo />
      <LandingCta />
      <LandingFooter />
    </div>
  );
}
