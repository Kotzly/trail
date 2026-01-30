import { marketingCopy } from "@trail/content";
import { MarketingFooter } from "../components/MarketingFooter";
import { MarketingNav } from "../components/MarketingNav";
import { Pricing } from "../components/blocks/pricing";

export default function PricingPage() {
  const { pricing } = marketingCopy;

  return (
    <div className="min-h-screen bg-base text-ink">
      <MarketingNav />
      <main className="pt-8">
        <Pricing
          plans={pricing.plans}
          title={pricing.title}
          description={pricing.description}
          eyebrow={pricing.eyebrow}
          toggleLabel={pricing.toggleLabel}
          toggleNote={pricing.toggleNote}
          billedMonthlyLabel={pricing.billedMonthlyLabel}
          billedAnnuallyLabel={pricing.billedAnnuallyLabel}
          popularBadge={pricing.popularBadge}
        />
      </main>
      <MarketingFooter />
    </div>
  );
}
