"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import { motion } from "motion/react";
import { Check, Sparkles, Star } from "lucide-react";
import { marketingCopy } from "@trail/content";
import { Switch } from "../ui/switch";
import { Label } from "../ui/label";
import { GlowingEffect } from "../ui/glowing-effect";

interface PricingPlan {
  name: string;
  price: string;
  yearlyPrice: string;
  period: string;
  features: readonly string[];
  description: string;
  buttonText: string;
  href: string;
  isPopular: boolean;
}

interface PricingCardProps {
  plan: PricingPlan;
  isMonthly: boolean;
  index: number;
}

function PricingCard({ plan, isMonthly, index }: PricingCardProps) {
  const price = isMonthly ? plan.price : plan.yearlyPrice;
  const isPopular = plan.isPopular;

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
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

      <div className="text-center">
        <h3 className="text-lg font-semibold text-ink">{plan.name}</h3>

        <div className="mt-4 flex items-baseline justify-center gap-1">
          <span className="text-4xl font-bold tracking-tight text-ink">
            ${price}
          </span>
          <span className="text-sm text-ink-subtle">/{plan.period}</span>
        </div>

        <p className="mt-1 text-xs text-ink-subtle">
          {isMonthly
            ? marketingCopy.pricing.billedMonthlyLabel
            : marketingCopy.pricing.billedAnnuallyLabel}
          {plan.name === "Teams" && (
            <span className="text-sm text-ink-subtle">, per user</span>
          )}
        </p>
      </div>

      <ul className="mt-6 flex-1 pb-6 space-y-3">
        {plan.features.map((feature, idx) => (
          <li key={idx} className="flex items-start gap-3">
            <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-accent" />
            <span className="text-sm text-ink-muted">{feature}</span>
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
        {plan.buttonText}
      </Link>

      <p className="mt-4 text-center text-xs text-ink-subtle">
        {plan.description}
      </p>
    </motion.div>
  );
}

export function PricingSection() {
  const { pricing } = marketingCopy;
  const [isMonthly, setIsMonthly] = useState(true);
  const switchRef = useRef<HTMLButtonElement>(null);

  const handleToggle = (checked: boolean) => {
    setIsMonthly(!checked);
  };

  const plans: PricingPlan[] = pricing.plans.map((plan) => ({
    name: plan.name,
    price: plan.price,
    yearlyPrice: plan.yearlyPrice,
    period: plan.period,
    features: plan.features,
    description: plan.description,
    buttonText: plan.buttonText,
    href: plan.href,
    isPopular: plan.isPopular,
  }));

  return (
    <section id="pricing" className="relative overflow-hidden px-6 py-24">
      {/* Background gradient */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/2 top-1/2 h-[700px] w-[700px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent/3 blur-3xl" />
      </div>

      <div className="relative mx-auto max-w-6xl">
        {/* Section header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center"
        >
          <span className="inline-block text-xs font-semibold uppercase tracking-wider text-accent">
            {pricing.eyebrow}
          </span>
          <h2 className="mt-4 text-3xl font-semibold tracking-tight text-ink md:text-4xl">
            {pricing.title}
          </h2>
          <p className="mx-auto mt-4 max-w-2xl whitespace-pre-line text-ink-muted">
            {pricing.description}
          </p>
        </motion.div>

        {/* Billing toggle */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="mt-8 flex items-center justify-center gap-3"
        >
          <span
            className={`text-sm ${isMonthly ? "text-ink" : "text-ink-subtle"}`}
          >
            {pricing.billedMonthlyLabel}
          </span>
          <Label className="relative inline-flex cursor-pointer items-center">
            <Switch
              ref={switchRef}
              checked={!isMonthly}
              onCheckedChange={handleToggle}
            />
          </Label>
          <span
            className={`text-sm ${!isMonthly ? "text-ink" : "text-ink-subtle"}`}
          >
            {pricing.billedAnnuallyLabel}
          </span>
          <span className="ml-1 rounded-full bg-accent/10 px-2 py-0.5 text-xs font-medium text-accent">
            {pricing.toggleNote}
          </span>
        </motion.div>

        {/* Pricing cards */}
        <div className="mt-12 grid grid-cols-1 gap-6 md:grid-cols-3 md:items-start">
          {plans.map((plan, index) => (
            <PricingCard
              key={plan.name}
              plan={plan}
              isMonthly={isMonthly}
              index={index}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
