import { HeroSection } from "./sections/HeroSection";
import { FeaturesSection } from "./sections/FeaturesSection";
import { CtaSection } from "./sections/CtaSection";
import type { SanitySection } from "../../lib/sanity/types";

const sectionMap: Record<string, React.ComponentType<{ section: SanitySection }>> = {
  heroSection: HeroSection as React.ComponentType<{ section: SanitySection }>,
  bentoFeaturesSection: FeaturesSection as React.ComponentType<{ section: SanitySection }>,
  ctaSection: CtaSection as React.ComponentType<{ section: SanitySection }>,
};

export function SectionRenderer({ sections }: { sections: SanitySection[] }) {
  if (!sections?.length) return null;

  return (
    <>
      {sections.map((section) => {
        const Component = sectionMap[section._type];
        if (!Component) {
          if (process.env.NODE_ENV === "development") {
            console.warn(`Unknown section type: ${section._type}`);
          }
          return null;
        }
        return <Component key={section._key} section={section} />;
      })}
    </>
  );
}
