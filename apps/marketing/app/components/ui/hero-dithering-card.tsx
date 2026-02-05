"use client";

import { ArrowRight, MoveRight } from "lucide-react";
import { useState, Suspense, lazy, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { marketingCopy } from "@trail/content";

const Dithering = lazy(() => 
  import("@paper-design/shaders-react").then((mod) => ({ default: mod.Dithering }))
);

interface HeroDitheringCardProps {
  eyebrow?: string;
  title: string;
  rotatingWords?: string[];
  description: string;
  ctaText: string;
  ctaHref: string;
  secondaryCtaText?: string;
  secondaryCtaHref?: string;
  showStats?: boolean;
}

export function HeroDitheringCard({
  eyebrow = "Browser app · free beta",
  title,
  rotatingWords = ["shareable paths", "clear decisions", "organized research", "team context", "calm workflows"],
  description,
  ctaText,
  ctaHref,
  secondaryCtaText,
  secondaryCtaHref,
  showStats = true,
}: HeroDitheringCardProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [titleNumber, setTitleNumber] = useState(0);
  
  const titles = useMemo(() => rotatingWords, [rotatingWords]);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (titleNumber === titles.length - 1) {
        setTitleNumber(0);
      } else {
        setTitleNumber(titleNumber + 1);
      }
    }, 2000);
    return () => clearTimeout(timeoutId);
  }, [titleNumber, titles]);

  const { stats, statsNote } = marketingCopy;

  return (
    <section className="relative pt-24 pb-8 w-full flex flex-col items-center px-4 md:px-6">
      <motion.div 
        className="w-full max-w-6xl relative"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <div className="relative overflow-hidden rounded-[3rem] border border-stroke/40 bg-surface/70 shadow-2xl shadow-accent/10 min-h-[600px] md:min-h-[700px] lg:min-h-[750px] flex flex-col items-center justify-center transition-all duration-500 hover:border-accent/30">
          {/* Dithering Background */}
          <Suspense fallback={<div className="absolute inset-0 bg-surface-strong/30" />}>
            <div className="absolute inset-0 z-0 pointer-events-none opacity-35 dark:opacity-30 mix-blend-multiply dark:mix-blend-screen">
              <Dithering
                colorBack="#00000000"
                colorFront="rgb(201 162 39)"
                shape="warp"
                type="4x4"
                speed={isHovered ? 0.8 : 0.25}
                className="size-full"
                minPixelRatio={1}
              />
            </div>
          </Suspense>

          {/* Gradient Overlay */}
          <div className="absolute inset-0 z-[1] bg-gradient-to-b from-base/60 via-transparent to-base/60 pointer-events-none" />

          {/* Content */}
          <div className="relative z-10 px-6 md:px-12 max-w-4xl mx-auto text-center flex flex-col items-center">
            {/* Eyebrow */}
            <motion.div 
              className="mb-8 inline-flex items-center gap-2 rounded-full border border-accent/30 bg-accent/10 px-4 py-1.5 text-xs font-medium uppercase tracking-wider text-accent backdrop-blur-sm"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
            >
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-accent"></span>
              </span>
              {eyebrow}
            </motion.div>

            {/* Headline with Rotating Words */}
            <motion.div 
              className="font-display text-5xl md:text-7xl lg:text-8xl font-semibold tracking-tight text-ink mb-6 leading-[1.05]"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.3 }}
            >
              <span className="block text-ink/70 mb-2">{title}</span>
              <span className="relative flex w-full justify-center overflow-hidden h-[1.2em] md:h-[1.15em]">
                <AnimatePresence mode="popLayout">
                  {titles.map((word, index) => (
                    <motion.span
                      key={index}
                      className="absolute font-semibold bg-gradient-to-r from-ink via-ink to-accent bg-clip-text text-transparent"
                      initial={{ opacity: 0, y: 100, scale: 0.8 }}
                      animate={
                        titleNumber === index
                          ? {
                              y: 0,
                              opacity: 1,
                              scale: 1,
                            }
                          : {
                              y: titleNumber > index ? -100 : 100,
                              opacity: 0,
                              scale: 0.8,
                            }
                      }
                      exit={{ opacity: 0, y: -100, scale: 0.8 }}
                      transition={{ 
                        type: "spring", 
                        stiffness: 100, 
                        damping: 20,
                        opacity: { duration: 0.3 }
                      }}
                    >
                      {word}
                    </motion.span>
                  ))}
                </AnimatePresence>
              </span>
            </motion.div>
            
            {/* Description */}
            <motion.p 
              className="text-ink-muted text-lg md:text-xl max-w-2xl mb-12 leading-relaxed"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.4 }}
            >
              {description}
            </motion.p>

            {/* Buttons */}
            <motion.div 
              className="flex flex-col sm:flex-row items-center gap-4"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.5 }}
            >
              <Link
                href={ctaHref}
                className="group relative inline-flex h-14 items-center justify-center gap-2 overflow-hidden rounded-full bg-cta px-8 text-base font-semibold text-cta-fg transition-all duration-300 hover:bg-cta-hover hover:scale-105 active:scale-95 hover:shadow-lg hover:shadow-cta/25"
              >
                <span>{ctaText}</span>
                <ArrowRight className="h-5 w-5 transition-transform duration-300 group-hover:translate-x-1" />
              </Link>
              
              {secondaryCtaText && secondaryCtaHref && (
                <Link
                  href={secondaryCtaHref}
                  className="group inline-flex h-14 items-center justify-center gap-2 rounded-full border border-stroke/60 bg-surface/50 px-8 text-base font-medium text-ink transition-all duration-300 hover:border-accent hover:bg-surface"
                >
                  {secondaryCtaText}
                  <MoveRight className="h-5 w-5 transition-transform duration-300 group-hover:translate-x-0.5" />
                </Link>
              )}
            </motion.div>
          </div>
        </div>
      </motion.div>

      {/* Stats Row - Below Card */}
      {showStats && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.6 }}
          className="mt-12 flex flex-wrap items-center justify-center gap-x-8 gap-y-4 text-sm"
        >
          {stats.map((stat, index) => (
            <div key={stat.label} className="flex items-baseline gap-2 px-2">
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
      )}
      
      {showStats && statsNote && (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.7 }}
          className="mt-3 text-xs text-ink-subtle/70"
        >
          {statsNote}
        </motion.p>
      )}
    </section>
  );
}

// Demo component for standalone use
export function CTASection() {
  return (
    <HeroDitheringCard
      eyebrow="Ready to get started?"
      title="Transform your"
      rotatingWords={["research workflow", "team productivity", "decision making"]}
      description="Join thousands of researchers who use Trail to organize their browsing and share insights with their teams."
      ctaText="Get the extension"
      ctaHref="/downloads"
      secondaryCtaText="View pricing"
      secondaryCtaHref="/pricing"
    />
  );
}
