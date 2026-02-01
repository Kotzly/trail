"use client";

import type { CSSProperties } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { marketingCopy } from "@trail/content";
import { InteractiveButton } from "./ui/interactive-button";

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.1,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.6,
      ease: [0.16, 1, 0.3, 1] as const,
    },
  },
};

export function MarketingHero() {
  const { hero, stats, statsNote } = marketingCopy;
  const words = hero.words;
  const wordCount = words.length;
  const transitionCount = Math.max(wordCount, 1);
  const loopWords = wordCount > 0 ? [...words, words[0]] : words;
  const segment = 100 / transitionCount;
  const holdFraction = 0.62;
  const bounceFraction = 0.82;
  const bounceOffset = 12;
  const animationName = `word-slide-${transitionCount}`;
  const animationDuration = `${transitionCount * 2}s`;

  const keyframeStops = Array.from({ length: transitionCount }, (_, index) => {
    const start = (segment * index).toFixed(4);
    const hold = (segment * index + segment * holdFraction).toFixed(4);
    const bounce = (segment * index + segment * bounceFraction).toFixed(4);
    const next = (segment * (index + 1)).toFixed(4);
    const currentOffset = `-${index * 100}%`;
    const nextOffset = `-${(index + 1) * 100}%`;
    const bounceOffsetValue = `calc(${nextOffset} - ${bounceOffset}%)`;
    return [
      `${start}% { transform: translateY(${currentOffset}); }`,
      `${hold}% { transform: translateY(${currentOffset}); }`,
      `${bounce}% { transform: translateY(${bounceOffsetValue}); }`,
      `${next}% { transform: translateY(${nextOffset}); }`,
    ].join("\n");
  }).join("\n");

  const keyframes = `@keyframes ${animationName} {
${keyframeStops}
}`;

  const shouldAnimate = transitionCount > 1;
  const wordVars = {
    "--word-animation-name": shouldAnimate ? animationName : "none",
    "--word-animation-duration": shouldAnimate ? animationDuration : "0s",
    "--word-animation-easing": "cubic-bezier(0.34, 1.56, 0.64, 1)",
  } as CSSProperties;

  return (
    <section className="relative overflow-hidden px-6 pb-16 pt-28 md:pt-32">
      {/* Subtle gradient orb background */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-1/4 -top-1/4 h-[600px] w-[600px] rounded-full bg-accent/5 blur-3xl" />
        <div className="absolute -right-1/4 top-1/3 h-[500px] w-[500px] rounded-full bg-accent/3 blur-3xl" />
      </div>

      <motion.div
        className="relative mx-auto max-w-6xl text-center"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        {/* Eyebrow pill */}
        <motion.div variants={itemVariants}>
          <span className="inline-flex items-center gap-2 rounded-full border border-accent/30 bg-accent/10 px-4 py-1.5 text-xs font-medium uppercase tracking-wider text-accent">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent/60 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-accent" />
            </span>
            {hero.pill}
          </span>
        </motion.div>

        {/* Main headline with word rotator */}
        <motion.h1
          className="mt-8 font-display text-4xl font-semibold leading-[1.15] tracking-tight text-ink md:text-6xl lg:text-7xl"
          variants={itemVariants}
        >
          <span className="block text-ink/60">{hero.lead}</span>
          <span className="mt-2 flex justify-center text-[clamp(1.8rem,5vw,3rem)] sm:text-4xl md:text-5xl lg:text-6xl">
            <span className="word-rotator text-ink" style={wordVars}>
              <span className="word-rotator-track">
                {loopWords.map((word, index) => (
                  <span
                    key={`${word}-${index}`}
                    className="bg-gradient-to-r from-ink via-ink to-accent bg-clip-text text-transparent"
                  >
                    {word}
                  </span>
                ))}
              </span>
            </span>
          </span>
        </motion.h1>
        <style dangerouslySetInnerHTML={{ __html: keyframes }} />

        {/* Subtitle */}
        <motion.p
          className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-ink-muted"
          variants={itemVariants}
        >
          {hero.summary}
        </motion.p>

        {/* CTA Buttons */}
        <motion.div
          className="mt-10 flex flex-wrap items-center justify-center gap-4"
          variants={itemVariants}
        >
          <InteractiveButton
            text={hero.ctaPrimary}
            href="/downloads"
            variant="primary"
            className="h-12 px-8 text-base"
          />
          <Link
            href="/#showcase"
            className="group inline-flex h-12 items-center gap-2 rounded-full border border-stroke/70 bg-surface/50 px-8 text-sm font-semibold text-ink backdrop-blur-sm transition-all hover:border-accent hover:bg-surface hover:shadow-lg hover:shadow-accent/5"
          >
            {hero.ctaSecondary}
            <svg
              className="h-4 w-4 transition-transform group-hover:translate-x-0.5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path
                d="M5 12h14M12 5l7 7-7 7"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </Link>
        </motion.div>

        {/* Stats row */}
        <motion.div
          className="mt-16 flex flex-wrap items-center justify-center gap-x-8 gap-y-4 text-sm"
          variants={itemVariants}
        >
          {stats.map((stat, index) => (
            <div
              key={stat.label}
              className="flex items-baseline gap-2 px-2"
            >
              <span className="text-2xl font-semibold tabular-nums text-ink">
                {stat.value}
              </span>
              <span className="text-ink-subtle">{stat.label}</span>
              {index < stats.length - 1 && (
                <span className="hidden md:inline-block ml-6 h-4 w-px bg-stroke/60" />
              )}
            </div>
          ))}
        </motion.div>

        {statsNote ? (
          <motion.p
            className="mt-3 text-xs text-ink-subtle/70"
            variants={itemVariants}
          >
            {statsNote}
          </motion.p>
        ) : null}
      </motion.div>
    </section>
  );
}
