import { TrustedBy } from "./components/TrustedBy";
import { BentoFeatures } from "./components/sections/BentoFeatures";
import { FAQSection } from "./components/sections/FAQSection";
import { PricingSection } from "./components/sections/PricingSection";
import Testimonials from "./components/sections/TestimonialsSection";
import VideoShowcases from "./components/sections/VideosSection";
import { CTASection } from "./components/ui/hero-dithering-card";
import { HeroWithVideo } from "./components/ui/hero-with-video";
import { MarketingPageShell } from "./shared/marketing-primitives";

export function HomeContent() {
  return (
    <MarketingPageShell>
      <div className="relative">
        <HeroWithVideo
          eyebrow="Browser app · free beta"
          title="Turn browsing into"
          rotatingWords={[
            "shareable paths",
            "clear decisions",
            "organized research",
            "team context",
            "calm workflows",
          ]}
          description="Capture every meaningful step, add notes when it matters, and share a clean research path instead of a tab dump."
          ctaText="Get Trail"
          ctaHref="/downloads"
          secondaryCtaText="See the 60s demo"
          secondaryCtaHref="/#showcase"
          posterUrl="/assets/video-poster-white.jpg"
          videoUrl="https://www.gettrail.net/assets/showcase.mp4"
        />
        <TrustedBy />
        <BentoFeatures />
        <VideoShowcases />
        {/* <Testimonials /> */}
        {/* <PricingSection /> */}
        <FAQSection />
        <CTASection />
      </div>
    </MarketingPageShell>
  );
}
