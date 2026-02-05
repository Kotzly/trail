"use client";

import { motion } from "framer-motion";
import { Zap } from "lucide-react";

export function FeaturesHero() {
  return (
    <section className="relative px-6 pt-32 pb-16">
      <div className="mx-auto max-w-4xl text-center">
        <motion.span
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="inline-flex items-center gap-2 rounded-full border border-accent/30 bg-accent/10 px-4 py-1.5 text-xs font-medium uppercase tracking-wider text-accent"
        >
          <Zap className="h-3.5 w-3.5" />
          Features
        </motion.span>

        <motion.h1
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="mt-6 font-display text-4xl font-semibold leading-[1.15] tracking-tight text-ink md:text-5xl lg:text-6xl"
        >
          Everything you need for
          <br />
          <span className="text-accent">better research</span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="mx-auto mt-4 max-w-2xl text-lg text-ink-muted"
        >
          Trail combines powerful features with a simple interface. No learning
          curve, no setup required.
        </motion.p>
      </div>
    </section>
  );
}
