"use client";

import { useRef } from "react";
import { motion, useScroll, useTransform } from "motion/react";
import { parseHeadline } from "../ui/parse-headline";
import type { HeroSectionData } from "../../../lib/sanity/types";

const ease = [0.25, 0.1, 0.25, 1] as const;

export function HeroSection({ section }: { section: HeroSectionData }) {
  const cta = section.ctas?.[0];
  const videoUrl: string | undefined = section.video?.asset?.url;
  const posterUrl: string | undefined = section.poster?.asset?.url;

  const sectionRef = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start start", "end start"],
  });

  const videoY = useTransform(scrollYProgress, [0, 1], [0, -120]);
  const videoScale = useTransform(scrollYProgress, [0, 0.5], [1, 1.05]);
  const videoRotateX = useTransform(scrollYProgress, [0, 0.4], [2, 0]);

  return (
    <section
      ref={sectionRef}
      className="relative flex min-h-svh flex-col items-center overflow-hidden"
    >
      {/* Content */}
      <div className="relative z-10 mx-auto max-w-4xl px-6 pt-40 text-center">
        {section.eyebrow && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.1, ease }}
            className="mb-8 flex justify-center"
          >
            <span className="inline-flex items-center gap-2 rounded-full border border-border-subtle bg-background px-3 py-1 text-xs tracking-label uppercase text-ember">
              <span className="h-1.5 w-1.5 rounded-full bg-ember" />
              {section.eyebrow}
            </span>
          </motion.div>
        )}

        <motion.h1
          className="tracking-display text-5xl font-bold leading-[0.95] sm:text-6xl md:text-7xl lg:text-8xl"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.3, ease }}
        >
          {parseHeadline(section.title ?? "")}
        </motion.h1>

        {section.description && (
          <motion.p
            className="tracking-body mx-auto mt-6 max-w-lg text-lg text-text-secondary sm:text-xl"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.5, ease }}
          >
            {section.description}
          </motion.p>
        )}

        {cta && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.7, ease }}
            className="mt-10"
          >
            <a
              href={cta.href}
              className="inline-flex rounded-full bg-primary px-8 py-3 text-base font-medium text-primary-foreground transition-shadow hover:shadow-[0_18px_48px_-12px_var(--ember-glow)] active:scale-[0.98]"
            >
              {cta.text}
            </a>
          </motion.div>
        )}
      </div>

      {/* Video with scroll parallax */}
      {videoUrl && (
        <motion.div
          className="relative z-10 mx-auto mt-12 w-full max-w-6xl px-4 pb-16"
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, delay: 0.9, ease }}
          style={{
            y: videoY,
            scale: videoScale,
            rotateX: videoRotateX,
            perspective: 1200,
          }}
        >
          <div
            className="relative overflow-hidden rounded-2xl"
            style={{
              maskImage:
                "radial-gradient(ellipse 95% 85% at 50% 45%, black 50%, transparent 100%)",
              WebkitMaskImage:
                "radial-gradient(ellipse 95% 85% at 50% 45%, black 50%, transparent 100%)",
            }}
          >
            <video
              autoPlay
              loop
              muted
              playsInline
              poster={posterUrl}
              className="w-full"
            >
              <source src={videoUrl} type="video/mp4" />
            </video>
          </div>
        </motion.div>
      )}
    </section>
  );
}
