"use client";

import { motion } from "motion/react";
import ColorBends from "../ui/color-bends";
import { parseHeadline } from "../ui/parse-headline";

const ease = [0.25, 0.1, 0.25, 1] as const;

/* eslint-disable @typescript-eslint/no-explicit-any */
export function HeroSection({ section }: { section: any }) {
  const cta = section.ctas?.[0];
  const videoUrl: string | undefined = section.video?.asset?.url;
  const posterUrl: string | undefined = section.poster?.asset?.url;

  return (
    <section className="relative flex min-h-svh flex-col items-center justify-center overflow-hidden">
      {/* Animated background */}
      <div className="pointer-events-none absolute inset-0">
        <ColorBends style={{ position: "absolute", inset: 0 }} />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_60%_at_50%_40%,_transparent_0%,_rgba(0,0,0,0.9)_100%)]" />
      </div>

      {/* Content */}
      <div className="relative z-10 mx-auto max-w-4xl px-6 pt-32 text-center">
        {section.eyebrow && (
          <motion.div
            initial={{ filter: "blur(10px)", opacity: 0, y: 24 }}
            animate={{ filter: "blur(0px)", opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.1, ease }}
            className="mb-8 flex justify-center"
          >
            <span className="inline-flex items-center gap-2 rounded-full border border-border-subtle bg-background px-3 py-1 text-xs tracking-label uppercase text-gold">
              <span className="h-1.5 w-1.5 rounded-full bg-gold animate-pulse" />
              {section.eyebrow}
            </span>
          </motion.div>
        )}

        <motion.h1
          className="tracking-display text-5xl font-bold leading-[0.95] sm:text-6xl md:text-7xl lg:text-8xl"
          initial={{ filter: "blur(10px)", opacity: 0, y: 24 }}
          animate={{ filter: "blur(0px)", opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.3, ease }}
        >
          {parseHeadline(section.title ?? "")}
        </motion.h1>

        {section.description && (
          <motion.p
            className="tracking-body mx-auto mt-6 max-w-lg text-lg text-text-secondary sm:text-xl"
            initial={{ filter: "blur(10px)", opacity: 0, y: 24 }}
            animate={{ filter: "blur(0px)", opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.5, ease }}
          >
            {section.description}
          </motion.p>
        )}

        {cta && (
          <motion.div
            initial={{ filter: "blur(10px)", opacity: 0, y: 24 }}
            animate={{ filter: "blur(0px)", opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.7, ease }}
            className="mt-10"
          >
            <a
              href={cta.href}
              className="inline-flex rounded-full bg-primary px-8 py-3 text-base font-medium text-primary-foreground transition-shadow hover:shadow-[0_0_24px_rgba(212,22,108,0.25)] active:scale-[0.98]"
            >
              {cta.text}
            </a>
          </motion.div>
        )}
      </div>

      {/* Video with vignette fade */}
      {videoUrl && (
        <motion.div
          className="relative z-10 mx-auto mt-16 w-full max-w-5xl px-6 pb-12"
          initial={{ filter: "blur(10px)", opacity: 0, y: 40 }}
          animate={{ filter: "blur(0px)", opacity: 1, y: 0 }}
          transition={{ duration: 1, delay: 0.9, ease }}
        >
          <div
            className="relative overflow-hidden rounded-2xl"
            style={{
              maskImage:
                "radial-gradient(ellipse 90% 80% at 50% 40%, black 40%, transparent 100%)",
              WebkitMaskImage:
                "radial-gradient(ellipse 90% 80% at 50% 40%, black 40%, transparent 100%)",
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
