"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import confetti from "canvas-confetti";
import NumberFlow from "@number-flow/react";
import { motion } from "framer-motion";
import { Check, Star } from "lucide-react";
import { cn } from "@trail/ui";
import { buttonVariants } from "../ui/button";
import { useMediaQuery } from "@/app/hooks/use-media-query";

interface PricingPlan {
  name: string;
  price: string;
  yearlyPrice: string;
  period: string;
  features: ReadonlyArray<string>;
  description: string;
  buttonText: string;
  href: string;
  isPopular: boolean;
}

interface PricingProps {
  plans: ReadonlyArray<PricingPlan>;
  title?: string;
  description?: string;
  eyebrow?: string;
  titleAs?: "h1" | "h2";
  toggleLabel?: string;
  toggleNote?: string;
  billedMonthlyLabel?: string;
  billedAnnuallyLabel?: string;
  popularBadge?: string;
}

export function Pricing({
  plans,
  title = "Simple, Transparent Pricing",
  description = "Choose the plan that works for you.",
  eyebrow,
  titleAs = "h2",
  toggleLabel = "Annual billing",
  toggleNote = "Save 20%",
  billedMonthlyLabel = "billed monthly",
  billedAnnuallyLabel = "billed annually",
  popularBadge = "Popular"
}: PricingProps) {
  const [isMonthly, setIsMonthly] = useState(true);
  const isDesktop = useMediaQuery("(min-width: 1024px)");
  const switchRef = useRef<HTMLButtonElement>(null);
  const TitleTag = titleAs;
  const handleToggle = () => {
    setIsMonthly((prev) => {
      const nextIsMonthly = !prev;
      if (!nextIsMonthly && switchRef.current) {
        const rect = switchRef.current.getBoundingClientRect();
        const x = rect.left + rect.width / 2;
        const y = rect.top + rect.height / 2;

        confetti({
          particleCount: 50,
          spread: 60,
          origin: {
            x: x / window.innerWidth,
            y: y / window.innerHeight
          },
          colors: ["#F97316", "#0D9488", "#14B8A6"],
          ticks: 200,
          gravity: 1.2,
          decay: 0.94,
          startVelocity: 30,
          shapes: ["circle"]
        });
      }
      return nextIsMonthly;
    });
  };

  return (
    <section id="pricing" className="px-6 py-20">
      <div className="mx-auto max-w-6xl">
        <div className="text-center space-y-4 mb-12">
          {eyebrow ? (
            <p className="trail-eyebrow text-ink-subtle">{eyebrow}</p>
          ) : null}
          <TitleTag className="font-display text-3xl font-semibold text-ink sm:text-4xl">
            {title}
          </TitleTag>
          <p className="mx-auto max-w-2xl text-sm text-ink-muted whitespace-pre-line">
            {description}
          </p>
        </div>

        <div className="flex flex-col items-center justify-center gap-4 sm:flex-row sm:gap-6 mb-10">
          <button
            type="button"
            ref={switchRef}
            role="switch"
            aria-checked={!isMonthly}
            aria-label="Toggle annual billing"
            onClick={handleToggle}
            className={cn(
              "relative inline-flex h-6 w-11 items-center rounded-full border border-border/70 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:ring-offset-2 focus-visible:ring-offset-base",
              !isMonthly ? "bg-accent" : "bg-surface-high"
            )}
          >
            <span
              className={cn(
                "inline-block h-5 w-5 rounded-full bg-surface shadow-lg transition-transform",
                !isMonthly ? "translate-x-5" : "translate-x-0"
              )}
            />
          </button>
          <span className="text-sm font-semibold text-ink">
            {toggleLabel}{" "}
            <span className="text-ink-muted">({toggleNote})</span>
          </span>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {plans.map((plan, index) => (
            <motion.div
              key={plan.name}
              initial={{ y: 40, opacity: 0 }}
              whileInView={{
                y: 0,
                opacity: 1,
                scale: plan.isPopular && isDesktop ? 1.04 : 1
              }}
              viewport={{ once: true }}
              transition={{
                duration: 0.8,
                ease: [0.16, 1, 0.3, 1],
                delay: index * 0.1
              }}
              className={cn(
                "relative rounded-3xl border p-6 text-center lg:flex lg:flex-col lg:justify-between",
                "bg-surface",
                plan.isPopular
                  ? "border-accent/60 bg-surface-high"
                  : "border-border/60"
              )}
            >
              {plan.isPopular && (
                <div className="absolute right-4 top-4 flex items-center gap-1 rounded-full border border-accent/40 bg-cta px-2 py-1 text-xs font-semibold text-cta-fg">
                  <Star className="h-3.5 w-3.5 fill-current" />
                  {popularBadge}
                </div>
              )}
              <div className="flex-1">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-ink-subtle">
                  {plan.name}
                </p>
                <div className="mt-6 flex items-center justify-center gap-x-2">
                  <span className="text-5xl font-semibold tracking-tight text-ink">
                    <NumberFlow
                      value={
                        isMonthly ? Number(plan.price) : Number(plan.yearlyPrice)
                      }
                      format={{
                        style: "currency",
                        currency: "USD",
                        minimumFractionDigits: 0,
                        maximumFractionDigits: 0
                      }}
                      transformTiming={{
                        duration: 500,
                        easing: "ease-out"
                      }}
                      willChange
                      className="tabular-nums"
                    />
                  </span>
                  <span className="text-xs font-semibold tracking-wide text-ink-subtle">
                    / {plan.period}
                  </span>
                </div>

                <p className="mt-2 text-xs text-ink-subtle">
                  {isMonthly ? billedMonthlyLabel : billedAnnuallyLabel}
                </p>

                <ul className="mt-5 flex flex-col gap-2 text-sm text-ink">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2">
                      <Check className="h-4 w-4 text-ink mt-1 flex-shrink-0" />
                      <span className="text-left text-ink-muted">
                        {feature}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>

              <hr className="my-6 border-border/60" />

              <Link
                href={plan.href}
                className={cn(
                  buttonVariants({ variant: "outline" }),
                  "group relative w-full gap-2 overflow-hidden text-sm font-semibold",
                  "transition-all duration-300 ease-out hover:bg-cta hover:text-cta-fg"
                )}
              >
                {plan.buttonText}
              </Link>
              <p className="mt-4 text-xs text-ink-subtle">{plan.description}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
