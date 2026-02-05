"use client";

import React, { useState, useMemo } from "react";
import { ArrowRight } from "../../../icons";
import Link from "next/link";
import { motion, AnimatePresence } from "motion/react";

interface HeroWithVideoProps {
  eyebrow?: string;
  title?: string;
  rotatingWords?: string[];
  description?: string;
  ctaText?: string;
  ctaHref?: string;
  secondaryCtaText?: string;
  secondaryCtaHref?: string;
  videoUrl?: string;
  posterUrl?: string;
}

export const HeroWithVideo: React.FC<HeroWithVideoProps> = ({
  eyebrow = "Browser app · free beta",
  title = "Turn browsing into",
  rotatingWords = [
    "shareable paths",
    "clear decisions",
    "organized research",
    "team context",
    "calm workflows",
  ],
  description = "Capture every meaningful step, add notes when it matters, and share a clean research path instead of a tab dump.",
  ctaText = "Get Trail",
  ctaHref = "/downloads",
  secondaryCtaText = "See the 60s demo",
  secondaryCtaHref = "#showcase",
  videoUrl = "https://www.gettrail.net/assets/showcase.mp4",
  posterUrl = "/assets/video-poster-white.jpg",
}) => {
  const [titleNumber, setTitleNumber] = useState(0);
  const titles = useMemo(() => rotatingWords, [rotatingWords]);

  React.useEffect(() => {
    const timeoutId = setTimeout(() => {
      setTitleNumber((prev) => (prev === titles.length - 1 ? 0 : prev + 1));
    }, 2000);
    return () => clearTimeout(timeoutId);
  }, [titleNumber, titles]);

  return (
    <section className="relative pt-24 pb-16 px-4 sm:px-6 lg:px-8 overflow-hidden">
      {/* Dithering Background - only within hero section */}
      <div className="absolute inset-0 -z-10 overflow-hidden">
        {/* Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-b from-base/70 via-base/40 to-base/70" />
      </div>

      <div className="max-w-6xl mx-auto relative">
        {/* Hero Text */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center mb-12"
        >
          {/* Eyebrow */}
          <motion.span
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="inline-flex items-center gap-2 rounded-full border border-accent/30 bg-accent/10 px-4 py-1.5 text-xs font-medium uppercase tracking-wider text-accent backdrop-blur-sm"
          >
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-accent"></span>
            </span>
            {eyebrow}
          </motion.span>

          {/* Title with Rotating Words */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="mt-6 font-display text-4xl sm:text-5xl md:text-7xl font-semibold tracking-tight text-ink leading-[1.1]"
          >
            <span className="block text-ink/70">{title}</span>
            <span className="relative flex w-full justify-center overflow-hidden h-[1.4em] md:h-[1.3em] pb-[0.15em] mt-2">
              <AnimatePresence mode="popLayout">
                {titles.map((word, index) => (
                  <motion.span
                    key={index}
                    className="absolute font-semibold text-accent"
                    initial={{ opacity: 0, y: 100, scale: 0.8 }}
                    animate={
                      titleNumber === index
                        ? { y: 0, opacity: 1, scale: 1 }
                        : {
                            y: titleNumber > index ? -100 : 100,
                            opacity: 0,
                            scale: 0.8,
                          }
                    }
                    exit={{ opacity: 0, y: -100, scale: 0.8 }}
                    transition={{ type: "spring", stiffness: 100, damping: 20 }}
                  >
                    {word}
                  </motion.span>
                ))}
              </AnimatePresence>
            </span>
          </motion.div>

          {/* Description */}
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="mt-6 text-lg sm:text-xl text-ink-muted max-w-2xl mx-auto"
          >
            {description}
          </motion.p>

          {/* CTA Buttons */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.4 }}
            className="mt-8 flex items-center justify-center gap-4 flex-wrap"
          >
            <Link
              href={ctaHref}
              className="group inline-flex h-12 items-center justify-center gap-2 rounded-full bg-cta px-6 text-sm font-semibold text-cta-fg transition-all hover:bg-cta-hover hover:scale-105"
            >
              {ctaText}
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Link>
            {secondaryCtaText && (
              <Link
                href={secondaryCtaHref}
                className="inline-flex h-12 items-center justify-center gap-2 rounded-full border border-stroke/60 bg-surface/50 px-6 text-sm font-medium text-ink transition-all hover:border-accent hover:bg-surface"
              >
                {secondaryCtaText}
              </Link>
            )}
          </motion.div>
        </motion.div>

        {/* Video Container */}
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.6, delay: 0.5 }}
          className="relative w-full aspect-video rounded-3xl overflow-hidden border border-stroke/40 shadow-2xl shadow-accent/5 bg-surface"
        >
          <video
            src={videoUrl}
            poster={posterUrl}
            className="w-full h-full object-cover"
            autoPlay
            muted
            loop
            playsInline
          />
        </motion.div>
      </div>
    </section>
  );
};

export default HeroWithVideo;
