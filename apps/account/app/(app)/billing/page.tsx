"use client";

import { useState } from "react";
import { CheckIcon } from "@radix-ui/react-icons";
import { Badge, Button, PageHeader, cn } from "@trail/ui";
import { accountCopy } from "@trail/content";

// TODO: Move to shared backend API /api/plans
// Same plans used in marketing and account
interface Plan {
  id: string;
  name: string;
  description: string;
  monthlyPrice: number;
  yearlyPricePerMonth: number; // Price per month when billed yearly
  features: string[];
  popular?: boolean;
  cta: string;
}

// Same pricing as in marketing app
const PLANS: Plan[] = [
  {
    id: "free",
    name: "free",
    description: "perfect for personal research and trying out trail.",
    monthlyPrice: 0,
    yearlyPricePerMonth: 0,
    features: [
      "7 days of trail history",
      "up to 50 paths per month",
      "basic export (markdown)",
      "local storage only",
      "community support",
    ],
    cta: "get started free",
  },
  {
    id: "pro",
    name: "pro",
    description: "for power users who need unlimited history and sync.",
    monthlyPrice: 10,
    yearlyPricePerMonth: 8,
    features: [
      "unlimited trail history",
      "unlimited paths",
      "cloud sync across devices",
      "advanced exports (pdf, json)",
      "priority support",
      "custom tags and filters",
    ],
    popular: true,
    cta: "start pro trial",
  },
  {
    id: "team",
    name: "team",
    description: "for teams collaborating on research together.",
    monthlyPrice: 20,
    yearlyPricePerMonth: 16,
    features: [
      "everything in pro",
      "shared team workspaces",
      "collaborative trails",
      "admin controls",
      "sso integration",
      "dedicated support",
      "custom integrations",
    ],
    cta: "contact sales",
  },
];

export default function BillingPage() {
  const { billing } = accountCopy;
  const [isYearly, setIsYearly] = useState(true);

  const formatPrice = (plan: Plan) => {
    const price = isYearly ? plan.yearlyPricePerMonth : plan.monthlyPrice;
    if (price === 0) return "free";
    return `$${price}`;
  };

  const getPeriodLabel = (plan: Plan) => {
    if (plan.monthlyPrice === 0) return "";
    return isYearly ? "/month, billed yearly" : "/month";
  };

  const getSavings = (plan: Plan) => {
    if (plan.monthlyPrice === 0) return null;
    const savings = Math.round(
      (1 - plan.yearlyPricePerMonth / plan.monthlyPrice) * 100,
    );
    return savings;
  };

  return (
    <section className="space-y-8">
      <PageHeader
        eyebrow={accountCopy.nav.billing}
        title={billing.title}
        subtitle={billing.subtitle}
        meta={
          <>
            <Badge className="bg-surface-strong text-xs font-medium text-ink">
              {billing.badgeEarly}
            </Badge>
            <Badge className="bg-surface-strong text-xs font-medium text-ink">
              {billing.badgePreview}
            </Badge>
          </>
        }
      />

      {/* Billing Toggle */}
      <div className="flex items-center justify-center">
        <div className="inline-flex items-center rounded-full border border-border/60 bg-surface/60 p-1">
          <button
            onClick={() => setIsYearly(false)}
            className={cn(
              "rounded-full px-4 py-2 text-sm lowercase transition",
              !isYearly
                ? "bg-cta text-cta-fg"
                : "text-ink-muted hover:text-ink",
            )}
          >
            monthly
          </button>
          <button
            onClick={() => setIsYearly(true)}
            className={cn(
              "rounded-full px-4 py-2 text-sm lowercase transition",
              isYearly ? "bg-cta text-cta-fg" : "text-ink-muted hover:text-ink",
            )}
          >
            yearly
          </button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {PLANS.map((plan) => {
          const isPopular = plan.popular;
          const savings = getSavings(plan);

          return (
            <div
              key={plan.id}
              className={cn(
                "flex h-full flex-col rounded-[26px] border bg-surface/60 px-6 py-6",
                isPopular
                  ? "border-accent/40 bg-surface/80"
                  : "border-border/60",
              )}
            >
              {/* Header */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold lowercase text-ink">
                    {plan.name}
                  </p>
                  <p className="text-xs text-ink-muted lowercase">
                    {plan.description}
                  </p>
                </div>
                {isPopular && (
                  <Badge className="bg-cta text-xs font-semibold text-cta-fg lowercase">
                    most popular
                  </Badge>
                )}
              </div>

              {/* Price */}
              <div className="mt-4">
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-semibold text-ink">
                    {formatPrice(plan)}
                  </span>
                  {plan.monthlyPrice > 0 && (
                    <span className="text-sm text-ink-muted lowercase">
                      {getPeriodLabel(plan)}
                    </span>
                  )}
                </div>
                {isYearly && savings && savings > 0 && (
                  <p className="mt-1 text-xs text-accent">
                    save {savings}% with yearly
                  </p>
                )}
                {!isYearly && savings && savings > 0 && (
                  <p className="mt-1 text-xs text-ink-subtle">
                    or ${plan.yearlyPricePerMonth}/month yearly
                  </p>
                )}
              </div>

              {/* Features */}
              <ul className="mt-6 flex-1 space-y-2 text-xs text-ink-muted lowercase">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2">
                    <CheckIcon className="mt-0.5 h-3 w-3 flex-shrink-0 text-ink" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>

              {/* CTA */}
              <div className="mt-6">
                <Button
                  size="sm"
                  variant={isPopular ? "primary" : "outline"}
                  className="w-full lowercase"
                >
                  {plan.cta}
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      <div className="text-center text-xs text-ink-muted lowercase">
        {billing.waitlistNote}
      </div>
    </section>
  );
}
