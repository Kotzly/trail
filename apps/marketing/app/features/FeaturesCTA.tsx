"use client";

import { motion } from "framer-motion";
import { Sparkles, Check, ArrowRight } from "lucide-react";
import Link from "next/link";

const plans = [
  "Unlimited trails",
  "Cloud sync",
  "Team workspaces",
  "Advanced exports",
  "Priority support",
];

export function FeaturesCTA() {
  return (
    <section className="relative px-6 py-16">
      <div className="mx-auto max-w-4xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="relative overflow-hidden rounded-3xl border border-stroke/40 bg-surface/70 p-8 text-center md:p-12"
        >
          <div className="relative">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-accent/10">
              <Sparkles className="h-7 w-7 text-accent" />
            </div>
            <h2 className="mt-6 text-2xl font-semibold text-ink md:text-3xl">
              Start organizing your research today
            </h2>
            <ul className="mt-6 flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm text-ink-muted">
              {plans.map((plan) => (
                <li key={plan} className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-accent" />
                  {plan}
                </li>
              ))}
            </ul>
            <div className="mt-8">
              <Link
                href="/downloads"
                className="inline-flex h-14 items-center justify-center gap-2 rounded-full bg-cta px-8 text-base font-semibold text-cta-fg transition-all hover:bg-cta-hover hover:scale-105"
              >
                Get started free
                <ArrowRight className="h-5 w-5" />
              </Link>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
