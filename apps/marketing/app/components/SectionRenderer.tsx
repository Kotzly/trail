import { HeroWithVideo } from "./ui/hero-with-video";
import { BentoFeatures } from "./sections/BentoFeatures";
import { FAQSection } from "./sections/FAQSection";
import VideoShowcases from "./sections/VideosSection";
import Testimonials from "./sections/TestimonialsSection";
import { PricingSection } from "./sections/PricingSection";
import { TrustedBy } from "./TrustedBy";
import { HeroDitheringCard } from "./ui/hero-dithering-card";
import { StatsSection } from "./sections/StatsSection";
import { ValuesSection } from "./sections/ValuesSection";
import { StorySection } from "./sections/StorySection";
import { ContactMethodsSection } from "./sections/ContactMethodsSection";
import { ContactFormSection } from "./sections/ContactFormSection";
import { BrowserCardsSection } from "./sections/BrowserCardsSection";
import { OnboardingStepsSection } from "./sections/OnboardingStepsSection";
import { FeaturesGridSection } from "./sections/FeaturesGridSection";
import { TimelineSection } from "./sections/TimelineSection";
import { SupportOptionsSection } from "./sections/SupportOptionsSection";
import { QuickLinksSection } from "./sections/QuickLinksSection";
import { ComparisonTableSection } from "./sections/ComparisonTableSection";
import { InfoColumnsSection } from "./sections/InfoColumnsSection";
import { SupportFlowSectionWrapper } from "./sections/SupportFlowSectionWrapper";
import { PageHeader } from "./sections/PageHeader";
import { SimpleCtaSection } from "./sections/SimpleCtaSection";

/* eslint-disable @typescript-eslint/no-explicit-any */
type SanitySection = {
  _type: string;
  _key: string;
  [key: string]: any;
};

function resolveFileUrl(file: any): string | undefined {
  return file?.asset?.url;
}

function resolveImageUrl(image: any): string | undefined {
  return image?.asset?.url;
}

function HeroAdapter({ section }: { section: any }) {
  const cta = section.ctas?.[0];
  return (
    <HeroWithVideo
      eyebrow={section.eyebrow}
      title={section.title}
      rotatingWords={section.rotatingWords}
      description={section.description}
      ctaText={cta?.text}
      ctaHref={cta?.href}
      videoUrl={resolveFileUrl(section.video)}
      posterUrl={resolveImageUrl(section.poster)}
    />
  );
}

function PageHeaderAdapter({ section }: { section: any }) {
  return (
    <PageHeader
      eyebrow={section.eyebrow}
      title={section.title}
      description={section.description}
    />
  );
}

function SimpleCtaAdapter({ section }: { section: any }) {
  return (
    <SimpleCtaSection
      title={section.title}
      description={section.description}
      primaryCta={section.primaryCta}
      secondaryCta={section.secondaryCta}
    />
  );
}

function TrustedByAdapter({ section }: { section: any }) {
  const brands = section.brands?.map((b: any) => ({
    name: b.name,
    file: resolveImageUrl(b.logo) ?? "",
    url: "#",
    logoSize: { width: 200, height: 60 },
  }));
  return <TrustedBy title={section.title} brands={brands} />;
}

function BentoFeaturesAdapter({ section }: { section: any }) {
  return (
    <BentoFeatures
      eyebrow={section.eyebrow}
      title={section.title}
      summary={section.summary}
      features={section.features}
    />
  );
}

function VideoShowcasesAdapter({ section }: { section: any }) {
  const items =
    section.items?.map((item: any) => ({
      eyebrow: item.eyebrow ?? "",
      title: item.title ?? "",
      description: item.description ?? "",
      video: resolveFileUrl(item.video) ?? "",
      preview: resolveFileUrl(item.video) ?? "",
    })) ?? [];
  return (
    <VideoShowcases
      content={{ title: section.title ?? "", sections: items }}
    />
  );
}

function FAQAdapter({ section }: { section: any }) {
  return (
    <FAQSection
      eyebrow={section.eyebrow}
      title={section.title}
      items={section.items}
    />
  );
}

function CTAAdapter({ section }: { section: any }) {
  return (
    <HeroDitheringCard
      eyebrow={section.eyebrow}
      title={section.title ?? ""}
      rotatingWords={section.rotatingWords}
      description={section.description ?? ""}
      ctaText={section.primaryCta?.text ?? ""}
      ctaHref={section.primaryCta?.href ?? "/downloads"}
      secondaryCtaText={section.secondaryCta?.text}
      secondaryCtaHref={section.secondaryCta?.href}
      stats={section.stats}
      statsNote={section.note}
      showStats={!!section.stats?.length}
      bulletPoints={section.bulletPoints}
    />
  );
}

function TestimonialsAdapter({ section }: { section: any }) {
  const items =
    section.items?.map((t: any) => ({
      name: t.name,
      role: t.role ?? "",
      quote: t.quote,
      image: resolveImageUrl(t.image) ?? "",
    })) ?? [];
  return <Testimonials testimonials={items} />;
}

function PricingAdapter({ section }: { section: any }) {
  return (
    <PricingSection
      eyebrow={section.eyebrow}
      title={section.title}
      description={section.description}
      toggleLabel={section.toggleLabel}
      toggleNote={section.toggleNote}
      plans={section.plans}
    />
  );
}

const sectionMap: Record<string, React.ComponentType<{ section: any }>> = {
  heroSection: HeroAdapter,
  trustedBySection: TrustedByAdapter,
  bentoFeaturesSection: BentoFeaturesAdapter,
  videoShowcasesSection: VideoShowcasesAdapter,
  faqSection: FAQAdapter,
  ctaSection: CTAAdapter,
  testimonialsSection: TestimonialsAdapter,
  pricingSection: PricingAdapter,
  statsSection: ({ section }) => <StatsSection {...section} />,
  valuesSection: ({ section }) => <ValuesSection {...section} />,
  storySection: ({ section }) => <StorySection {...section} />,
  contactMethodsSection: ({ section }) => (
    <ContactMethodsSection {...section} />
  ),
  contactFormSection: ({ section }) => <ContactFormSection {...section} />,
  browserCardsSection: ({ section }) => <BrowserCardsSection {...section} />,
  onboardingStepsSection: ({ section }) => (
    <OnboardingStepsSection {...section} />
  ),
  featuresGridSection: ({ section }) => <FeaturesGridSection {...section} />,
  timelineSection: ({ section }) => <TimelineSection {...section} />,
  supportOptionsSection: ({ section }) => (
    <SupportOptionsSection {...section} />
  ),
  quickLinksSection: ({ section }) => <QuickLinksSection {...section} />,
  comparisonTableSection: ({ section }) => (
    <ComparisonTableSection {...section} />
  ),
  infoColumnsSection: ({ section }) => <InfoColumnsSection {...section} />,
  supportFlowSection: () => <SupportFlowSectionWrapper />,
  pageHeaderSection: PageHeaderAdapter,
  simpleCtaSection: SimpleCtaAdapter,
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
