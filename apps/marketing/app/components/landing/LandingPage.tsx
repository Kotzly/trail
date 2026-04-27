import dynamic from "next/dynamic";
import { LandingNav } from "./Nav";
import { LandingHero } from "./Hero";
import { LandingFeatures } from "./Features";
import { LandingCta } from "./Cta";
import { LandingFooter } from "./Footer";

// Below-the-fold, motion-heavy interactive demo: ship as its own
// chunk so it doesn't block the hero on slow networks.
const LandingDemo = dynamic(
  () => import("./Demo").then((m) => ({ default: m.LandingDemo })),
  {
    loading: () => (
      <div
        aria-hidden="true"
        style={{ minHeight: "100vh", background: "var(--landing-bg)" }}
      />
    ),
  },
);

export function LandingPage() {
  return (
    <div data-landing className="relative">
      <LandingNav />
      <LandingHero />
      <LandingFeatures />
      <LandingDemo />
      <LandingCta />
      <LandingFooter />
    </div>
  );
}
