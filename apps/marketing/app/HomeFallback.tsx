import { marketingCopy } from "@trail/content";
import { TrustedBy } from "./components/TrustedBy";
import { BentoFeatures } from "./components/sections/BentoFeatures";
import { FAQSection } from "./components/sections/FAQSection";
import VideoShowcases from "./components/sections/VideosSection";
import { CTASection } from "./components/ui/hero-dithering-card";
import { HeroWithVideo } from "./components/ui/hero-with-video";
import { MarketingPageShell } from "./shared/marketing-primitives";
import { videos } from "./data/videos";

export function HomeFallback() {
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
          videoUrl="https://www.gettrail.net/assets/showcase.mp4"
          posterUrl="/assets/video-poster-white.jpg"
        />
        <TrustedBy />
        <BentoFeatures
          eyebrow={marketingCopy.features.eyebrow}
          title={marketingCopy.features.title}
          summary={marketingCopy.features.summary}
          features={marketingCopy.features.items}
        />
        <VideoShowcases content={videos} />
        <FAQSection
          eyebrow={marketingCopy.faq.eyebrow}
          title={marketingCopy.faq.title}
          items={marketingCopy.faq.items}
        />
        <CTASection />
      </div>
    </MarketingPageShell>
  );
}
