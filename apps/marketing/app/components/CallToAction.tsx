"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { marketingCopy } from "@trail/content";
import { InteractiveButton } from "./ui/interactive-button";

export function CallToAction() {
  const { cta } = marketingCopy;

  return (
    <section className="relative overflow-hidden px-6 py-24">
      {/* Background gradient */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/2 top-1/2 h-[600px] w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent/5 blur-3xl" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6 }}
        className="relative mx-auto max-w-4xl text-center"
      >
        <h2 className="text-3xl font-semibold tracking-tight text-ink md:text-4xl lg:text-5xl">
          {cta.title}
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-ink-muted">
          {cta.subtitle}
        </p>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
          <InteractiveButton
            text={cta.primary}
            href="/downloads"
            variant="primary"
            className="h-12 px-8 text-base"
          />
          <Link
            href="https://app.gettrail.net"
            className="inline-flex h-12 items-center gap-2 rounded-full border border-stroke/70 bg-surface/50 px-8 text-sm font-semibold text-ink backdrop-blur-sm transition-all hover:border-accent hover:bg-surface hover:shadow-lg hover:shadow-accent/5"
          >
            {cta.secondary}
          </Link>
        </div>

        <p className="mt-6 text-sm text-ink-subtle">
          {cta.note}
        </p>
      </motion.div>
    </section>
  );
}
