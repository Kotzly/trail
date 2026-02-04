"use client";

import { useState, Suspense } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Check, HelpCircle, ArrowRight, Sparkles, Zap, Building2 } from "lucide-react";
import { Button } from "@trail/ui";
import { GlowingEffect } from "../components/ui/glowing-effect";
import { Switch } from "../components/ui/switch";
import { Label } from "../components/ui/label";
import { PricingLoading } from "../components/page-wrapper";

interface Plan {
  name: string;
  description: string;
  monthlyPrice: number;
  yearlyPrice: number;
  features: string[];
  cta: string;
  popular?: boolean;
  icon: React.ReactNode;
}

const plans: Plan[] = [
  {
    name: "Free",
    description: "Perfect for personal research and trying out Trail.",
    monthlyPrice: 0,
    yearlyPrice: 0,
    features: [
      "7 days of trail history",
      "Up to 50 paths per month",
      "Basic export (Markdown)",
      "Local storage",
      "Community support",
    ],
    cta: "Get started",
    icon: <Sparkles className="h-5 w-5" />,
  },
  {
    name: "Pro",
    description: "For power users who need unlimited history and sync.",
    monthlyPrice: 10,
    yearlyPrice: 8,
    features: [
      "Unlimited trail history",
      "Unlimited paths",
      "Cloud sync across devices",
      "Advanced exports (PDF, JSON)",
      "Priority support",
      "Custom tags and filters",
      "More features coming soon"
    ],
    cta: "Start Pro Trial",
    popular: true,
    icon: <Zap className="h-5 w-5" />,
  },
  {
    name: "Teams",
    description: "For teams collaborating on research together.",
    monthlyPrice: 20,
    yearlyPrice: 16,
    features: [
      "Everything in Pro",
      "Shared team workspaces",
      "Admin controls",
      "SSO integration",
      "Dedicated support",
      "Custom integrations",
      "Collaborative trails soon",
    ],
    cta: "Contact Sales",
    icon: <Building2 className="h-5 w-5" />,
  },
];

const faqs = [
  {
    question: "Can I switch plans anytime?",
    answer: "Yes, you can switch plans at any time. You'll keep your data and continue using Trail until the end of your current billing period.",
  },
  {
    question: "What happens to my data if I cancel?",
    answer: "Your data remains accessible in read-only mode for 30 days. You can export everything before leaving.",
  },
  {
    question: "Is there a discount for nonprofits?",
    answer: "Yes, we offer 50% off for verified nonprofits and educational institutions. Contact us for details.",
  },
];

function PricingContent() {
  const [isYearly, setIsYearly] = useState(true);

  return (
    <div className="min-h-screen bg-base text-ink">
      <main className="relative overflow-hidden">
        {/* Hero */}
        <section className="relative px-6 pt-20 pb-8">
          <div className="mx-auto max-w-6xl text-center">
            <motion.span
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="inline-block text-xs font-semibold uppercase tracking-wider text-accent"
            >
              Pricing
            </motion.span>
            
            <motion.h1
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="mt-4 font-display text-4xl font-semibold leading-[1.15] tracking-tight text-ink md:text-5xl lg:text-6xl"
            >
              Simple, transparent pricing
            </motion.h1>
            
            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="mx-auto mt-4 max-w-2xl text-lg text-ink-muted"
            >
              Start free, upgrade when you need more. No credit card required.
            </motion.p>

            {/* Toggle */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.3 }}
              className="mt-8 flex items-center justify-center gap-3"
            >
              <span className={`text-sm ${!isYearly ? "text-ink" : "text-ink-subtle"}`}>
                Monthly
              </span>
              <Label className="relative inline-flex cursor-pointer items-center">
                <Switch
                  checked={isYearly}
                  onCheckedChange={setIsYearly}
                />
              </Label>
              <span className={`text-sm ${isYearly ? "text-ink" : "text-ink-subtle"}`}>
                Yearly
              </span>
              <span className="ml-1 rounded-full bg-green-500/10 px-2 py-0.5 text-xs font-medium text-green-600">
                Save 20%
              </span>
            </motion.div>
          </div>
        </section>

        {/* Plans */}
        <section className="relative px-6 py-12">
          <div className="mx-auto max-w-6xl">
            <div className="grid gap-6 lg:grid-cols-3 items-stretch">
              {plans.map((plan, index) => {
                const price = isYearly ? plan.yearlyPrice : plan.monthlyPrice;
                const isPopular = plan.popular;
                
                return (
                  <motion.div
                    key={plan.name}
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{
                      duration: 0.5,
                      delay: index * 0.1,
                      ease: [0.16, 1, 0.3, 1] as const,
                    }}
                    whileHover={isPopular ? { y: -8 } : { y: -4 }}
                    className={`relative flex h-full flex-col rounded-3xl border bg-surface/70 p-6 backdrop-blur-sm ${
                      isPopular
                        ? "border-accent/50 shadow-xl shadow-accent/10 lg:-mt-4"
                        : "border-stroke/40 hover:border-accent/30 hover:shadow-lg"
                    }`}
                  >
                    {isPopular && (
                      <>
                        <GlowingEffect
                          spread={40}
                          glow={true}
                          disabled={false}
                          proximity={60}
                          inactiveZone={0.01}
                          borderWidth={2}
                        />
                        <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                          <span className="inline-flex items-center gap-1 rounded-full bg-accent px-3 py-1 text-xs font-semibold text-cta-fg">
                            <Sparkles className="h-3 w-3" />
                            Most Popular
                          </span>
                        </div>
                      </>
                    )}

                    <div className="relative flex h-full flex-col">
                      <div className="flex items-center gap-3">
                        <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${
                          isPopular ? "bg-accent/10 text-accent" : "bg-surface-strong text-ink-muted"
                        }`}>
                          {plan.icon}
                        </div>
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
                          {price > 0 && <span className="text-sm text-ink-subtle">/month{ plan.name === "Teams" ? " per user" : ""}, {isYearly ? "billed annually" : "billed monthly"}</span>}
                        </div>
                      </div>

                      <ul className="mt-6 flex-1 space-y-3 pb-6">
                        {plan.features.map((feature, i) => (
                          <li key={i} className="flex items-start gap-3 text-sm text-ink-muted">
                            <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-accent" />
                            {feature}
                          </li>
                        ))}
                      </ul>

                      <Link
                        href={plan.name === "Teams" ? "/contact" : "/downloads"}
                        className={`mt-auto block w-full rounded-full px-4 py-3 text-center text-sm font-semibold transition-all duration-200 ${
                          isPopular
                            ? "bg-cta text-cta-fg hover:bg-cta-hover hover:shadow-lg hover:shadow-cta/25"
                            : "border border-stroke/60 bg-surface text-ink hover:border-accent hover:bg-surface-strong"
                        }`}
                      >
                        {plan.cta}
                      </Link>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>
        </section>

        {/* Compare */}
        <section className="relative px-6 py-16">
          <div className="mx-auto max-w-4xl">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="rounded-3xl border border-stroke/40 bg-surface/50 p-8"
            >
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
                    {[
                      ["Trail history", "7 days", "Unlimited", "Unlimited"],
                      ["Paths per month", "50", "Unlimited", "Unlimited"],
                      ["Cloud sync", "—", "✓", "✓"],
                      ["Export formats", "Markdown", "All formats", "All formats"],
                      ["Collaboration", "—", "—", "✓"],
                      ["Support", "Community", "Priority", "Dedicated"],
                    ].map(([feature, free, pro, team], i) => (
                      <tr key={i}>
                        <td className="py-4 text-ink-muted">{feature}</td>
                        <td className="py-4 text-center text-ink-subtle">{free}</td>
                        <td className="py-4 text-center text-accent">{pro}</td>
                        <td className="py-4 text-center text-ink-subtle">{team}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </motion.div>
          </div>
        </section>

        {/* FAQ */}
        <section className="relative px-6 py-16">
          <div className="mx-auto max-w-3xl">
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
              {faqs.map((faq, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 10 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.4, delay: index * 0.1 }}
                  className="rounded-2xl border border-stroke/40 bg-surface/50 p-6"
                >
                  <h3 className="flex items-center gap-2 font-medium text-ink">
                    <HelpCircle className="h-4 w-4 text-accent" />
                    {faq.question}
                  </h3>
                  <p className="mt-2 text-sm text-ink-muted">{faq.answer}</p>
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
          </div>
        </section>

        {/* CTA */}
        <section className="relative px-6 py-16">
          <div className="mx-auto max-w-4xl">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="relative overflow-hidden rounded-3xl border border-stroke/40 bg-surface/70 p-8 text-center md:p-12"
            >
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
                  Join thousands of researchers who trust Trail to organize their browsing.
                </p>
                <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
                  <Button size="lg" className="w-full sm:w-auto">
                    Start Free Trial
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                  <Button variant="outline" size="lg" className="w-full sm:w-auto">
                    Talk to Sales
                  </Button>
                </div>
              </div>
            </motion.div>
          </div>
        </section>
      </main>
    </div>
  );
}

export default function PricingPage() {
  return (
    <Suspense fallback={<PricingLoading />}>
      <PricingContent />
    </Suspense>
  );
}
