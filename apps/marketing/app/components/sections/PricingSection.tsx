import { marketingCopy } from "@trail/content";
import { Pricing } from "../blocks/pricing";

export function PricingSection() {
  const { pricing } = marketingCopy;

  return (
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
  );
}
