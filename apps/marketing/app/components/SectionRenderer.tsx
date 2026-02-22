import { HeroSection } from "./sections/HeroSection";
import { FeaturesSection } from "./sections/FeaturesSection";
import { CtaSection } from "./sections/CtaSection";

/* eslint-disable @typescript-eslint/no-explicit-any */
type SanitySection = {
  _type: string;
  _key: string;
  [key: string]: any;
};

const sectionMap: Record<string, React.ComponentType<{ section: any }>> = {
  heroSection: HeroSection,
  bentoFeaturesSection: FeaturesSection,
  ctaSection: CtaSection,
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
