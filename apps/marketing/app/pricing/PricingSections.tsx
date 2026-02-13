"use client";

import { useState } from "react";
import Link from "next/link";
import { motion } from "motion/react";
import {
  ArrowRight,
  Building2,
  Check,
  HelpCircle,
  Sparkles,
  Zap,
} from "@trail/ui/icons";
import { Button } from "@trail/ui";
import { trailPlans, type TrailPlanId } from "@trail/content";
import { GlowingEffect } from "../components/ui/glowing-effect";
import { Label } from "../components/ui/label";
import { Switch } from "../components/ui/switch";
import {
  HeroBadge,
  HeroSubtitle,
  HeroTitle,
  IconChip,
  MarketingPageShell,
  PageSection,
  SectionContainer,
  SurfaceCard,
} from "../shared/marketing-primitives";

type Plan = {
  id: TrailPlanId;
  name: string;
  description: string;
  monthlyPrice: number;
  yearlyPrice: number;
  features: string[];
  cta: string;
  popular?: boolean;
  icon: typeof Sparkles;
};

function resolvePlanPrice(planId: TrailPlanId): {
  monthlyPrice: number;
  yearlyPrice: number;
} {
  const plan = trailPlans.find((item) => item.id === planId);
  if (!plan) {
    return { monthlyPrice: 0, yearlyPrice: 0 };
  }

  return {
    monthlyPrice: plan.priceMonthly,
    yearlyPrice: plan.priceYearly > 0 ? plan.priceYearly / 12 : 0,
  };
}

const plans: Plan[] = [
  {
    id: "free",
    name: "Free",
    description: "Perfect for personal research and trying out Trail.",
    ...resolvePlanPrice("free"),
    features: [
      "7 days of trail history",
      "Up to 50 paths per month",
      "Basic export (Markdown)",
      "Local storage",
      "Community support",
    ],
    cta: "Get started",
    icon: Sparkles,
  },
  {
    id: "pro",
    name: "Pro",
    description: "For power users who need unlimited history and sync.",
    ...resolvePlanPrice("pro"),
    features: [
      "Unlimited trail history",
      "Unlimited paths",
      "Cloud sync across devices",
      "Advanced exports (PDF, JSON)",
      "Priority support",
      "Custom tags and filters",
      "More features coming soon",
    ],
    cta: "Upgrade to Pro",
    popular: true,
    icon: Zap,
  },
  {
    id: "teams",
    name: "Teams",
    description: "For teams collaborating on research together.",
    ...resolvePlanPrice("teams"),
    features: [
      "Everything in Pro",
      "Shared team workspaces",
      "Admin controls",
      "SSO integration",
      "Dedicated support",
      "Custom integrations",
      "Collaborative trails soon",
    ],
    cta: "Upgrade to Teams",
    icon: Building2,
  },
];

const compareRows = [
  ["Trail history", "7 days", "Unlimited", "Unlimited"],
  ["Paths per month", "50", "Unlimited", "Unlimited"],
  ["Cloud sync", "—", "✓", "✓"],
  ["Export formats", "Markdown", "All formats", "All formats"],
  ["Collaboration", "—", "—", "✓"],
  ["Support", "Community", "Priority", "Dedicated"],
];

const pricingFaqs = [
  {
    question: "Can I switch plans anytime?",
    answer:
      "Yes, you can switch plans at any time. You'll keep your data and continue using Trail until the end of your current billing period.",
  },
  {
    question: "What happens to my data if I cancel?",
    answer:
      "Your data remains accessible in read-only mode for 30 days. You can export everything before leaving.",
  },
  {
    question: "Is there a discount for nonprofits?",
    answer:
      "Yes, we offer 50% off for verified nonprofits and educational institutions. Contact us for details.",
  },
];

function BillingToggle({
  isYearly,
  onChange,
}: {
  isYearly: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <div className="mt-8 flex items-center justify-center gap-3">
      <span className={isYearly ? "text-sm text-ink-subtle" : "text-sm text-ink"}>
        Monthly
      </span>
      <Label className="relative inline-flex cursor-pointer items-center">
        <Switch checked={isYearly} onCheckedChange={onChange} />
      </Label>
      <span className={isYearly ? "text-sm text-ink" : "text-sm text-ink-subtle"}>
        Yearly
      </span>
      <span className="ml-1 rounded-full bg-green-500/10 px-2 py-0.5 text-xs font-medium text-green-600">
        Save with yearly
      </span>
    </div>
  );
}

function PricingHeroSection({
  isYearly,
  onToggleYearly,
}: {
  isYearly: boolean;
  onToggleYearly: (value: boolean) => void;
}) {
  return (
    <PageSection spacing="hero">
      <SectionContainer size="lg" className="text-center">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <HeroBadge>Pricing</HeroBadge>
          <HeroTitle>Simple, transparent pricing</HeroTitle>
          <HeroSubtitle>
            Start free, upgrade when you need more. No credit card required.
          </HeroSubtitle>
          <BillingToggle isYearly={isYearly} onChange={onToggleYearly} />
        </motion.div>
      </SectionContainer>
    </PageSection>
  );
}

function PlanCard({
  plan,
  price,
  isYearly,
  index,
}: {
  plan: Plan;
  price: number;
  isYearly: boolean;
  index: number;
}) {
  const Icon = plan.icon;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
  const billingHref = appUrl ? `${appUrl.replace(/\/+$/, "")}/billing` : "/downloads";
  const ctaHref = plan.id === "free" ? "/downloads" : billingHref;

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: 0.5,
        delay: index * 0.1,
        ease: [0.16, 1, 0.3, 1] as const,
      }}
      className={plan.popular ? "lg:-mt-4" : undefined}
    >
      <SurfaceCard
        className={
          plan.popular
            ? "relative h-full overflow-hidden border-accent/50 bg-surface/70 p-6 shadow-xl shadow-accent/10"
            : "relative h-full bg-surface/70 p-6"
        }
      >
        {plan.popular ? (
          <>
            <GlowingEffect
              spread={40}
              glow={true}
              disabled={false}
              proximity={60}
              inactiveZone={0.01}
              borderWidth={2}
            />
            <div className="absolute left-1/2 top-0 -translate-x-1/2 -translate-y-1/2">
              <span className="inline-flex items-center gap-1 rounded-full bg-accent px-3 py-1 text-xs font-semibold text-cta-fg">
                <Sparkles className="h-3 w-3" />
                Most Popular
              </span>
            </div>
          </>
        ) : null}

        <div className="relative flex h-full flex-col">
          <div className="flex items-center gap-3">
            <IconChip accent={Boolean(plan.popular)}>
              <Icon className="h-5 w-5" />
            </IconChip>
            <div>
              <h3 className="text-lg font-semibold text-ink">{plan.name}</h3>
              <p className="text-xs text-ink-subtle">{plan.description}</p>
            </div>
          </div>

          <div className="mt-6">
            <div className="flex items-baseline gap-1">
              <span className="text-4xl font-bold tracking-tight text-ink">
                ${price}
              </span>
              {price > 0 ? (
                <span className="text-sm text-ink-subtle">
                  /month{plan.name === "Teams" ? " per user" : ""},{" "}
                  {isYearly ? "billed annually" : "billed monthly"}
                </span>
              ) : null}
            </div>
          </div>

          <ul className="mt-6 flex-1 space-y-3 pb-6">
            {plan.features.map((feature) => (
              <li key={feature} className="flex items-start gap-3 text-sm text-ink-muted">
                <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-accent" />
                {feature}
              </li>
            ))}
          </ul>

          <Button.AsChild
            variant={plan.popular ? "primary" : "outline"}
            className="mt-auto w-full"
          >
            <Link href={ctaHref}>{plan.cta}</Link>
          </Button.AsChild>
        </div>
      </SurfaceCard>
    </motion.div>
  );
}

function PlansSection({ isYearly }: { isYearly: boolean }) {
  return (
    <PageSection spacing="default">
      <SectionContainer size="lg">
        <div className="grid items-stretch gap-6 lg:grid-cols-3">
          {plans.map((plan, index) => (
            <PlanCard
              key={plan.name}
              plan={plan}
              price={isYearly ? plan.yearlyPrice : plan.monthlyPrice}
              isYearly={isYearly}
              index={index}
            />
          ))}
        </div>
      </SectionContainer>
    </PageSection>
  );
}

function ComparisonSection() {
  return (
    <PageSection spacing="spacious">
      <SectionContainer size="md">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          <SurfaceCard className="p-8">
            <h2 className="text-xl font-semibold text-ink">Compare plans</h2>

            <div className="mt-6 overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-stroke/40">
                    <th className="pb-4 font-medium text-ink-subtle">Feature</th>
                    <th className="pb-4 text-center font-medium text-ink">Free</th>
                    <th className="pb-4 text-center font-medium text-accent">Pro</th>
                    <th className="pb-4 text-center font-medium text-ink">Teams</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stroke/30">
                  {compareRows.map(([feature, free, pro, team]) => (
                    <tr key={feature}>
                      <td className="py-4 text-ink-muted">{feature}</td>
                      <td className="py-4 text-center text-ink-subtle">{free}</td>
                      <td className="py-4 text-center text-accent">{pro}</td>
                      <td className="py-4 text-center text-ink-subtle">{team}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </SurfaceCard>
        </motion.div>
      </SectionContainer>
    </PageSection>
  );
}

function PricingFaqSection() {
  return (
    <PageSection spacing="spacious">
      <SectionContainer size="sm">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center"
        >
          <h2 className="text-2xl font-semibold text-ink">Frequently asked questions</h2>
        </motion.div>

        <div className="mt-8 space-y-4">
          {pricingFaqs.map((faq, index) => (
            <motion.div
              key={faq.question}
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: index * 0.1 }}
            >
              <SurfaceCard className="p-6">
                <h3 className="flex items-center gap-2 font-medium text-ink">
                  <HelpCircle className="h-4 w-4 text-accent" />
                  {faq.question}
                </h3>
                <p className="mt-2 text-sm text-ink-muted">{faq.answer}</p>
              </SurfaceCard>
            </motion.div>
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="mt-8 text-center"
        >
          <p className="text-sm text-ink-muted">
            Still have questions?{" "}
            <Link href="/contact" className="text-accent hover:underline">
              Contact us
            </Link>
          </p>
        </motion.div>
      </SectionContainer>
    </PageSection>
  );
}

function PricingCtaSection() {
  return (
    <PageSection spacing="spacious">
      <SectionContainer size="md">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          <SurfaceCard className="relative overflow-hidden bg-surface/70 p-8 text-center md:p-12">
            <GlowingEffect
              spread={60}
              glow={true}
              disabled={false}
              proximity={80}
              inactiveZone={0.01}
              borderWidth={2}
            />
            <div className="relative">
              <h2 className="text-2xl font-semibold text-ink md:text-3xl">
                Ready to transform your research?
              </h2>
              <p className="mx-auto mt-3 max-w-lg text-ink-muted">
                Join thousands of researchers who trust Trail to organize their
                browsing.
              </p>
              <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
                <Button.AsChild size="lg" className="w-full sm:w-auto">
                  <Link href="/downloads">
                    Start Free Trial
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button.AsChild>
                <Button.AsChild variant="outline" size="lg" className="w-full sm:w-auto">
                  <Link href="/contact">Talk to Sales</Link>
                </Button.AsChild>
              </div>
            </div>
          </SurfaceCard>
        </motion.div>
      </SectionContainer>
    </PageSection>
  );
}

export function PricingContent() {
  const [isYearly, setIsYearly] = useState(true);

  return (
    <MarketingPageShell>
      <PricingHeroSection isYearly={isYearly} onToggleYearly={setIsYearly} />
      <PlansSection isYearly={isYearly} />
      <ComparisonSection />
      <PricingFaqSection />
      <PricingCtaSection />
    </MarketingPageShell>
  );
}
