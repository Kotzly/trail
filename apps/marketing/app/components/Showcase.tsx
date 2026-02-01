"use client";

import { motion } from "framer-motion";
import { marketingCopy } from "@trail/content";

export function Showcase() {
  const { showcase } = marketingCopy;
  const mediaBase = "https://www.gettrail.net";
  const posterSrc = `${mediaBase}/assets/video-poster-white.jpg`;
  const videoSrc = `${mediaBase}/assets/showcase.mp4`;
  const captionsSrc = `${mediaBase}/assets/showcase.vtt`;

  return (
    <section
      id="showcase"
      className="relative mx-auto flex max-w-6xl flex-col items-center px-6 py-16 text-center"
    >
      <motion.span
        initial={{ opacity: 0, y: 10 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5 }}
        className="inline-block text-xs font-semibold uppercase tracking-wider text-accent"
      >
        Showcase
      </motion.span>
      <motion.h2
        initial={{ opacity: 0, y: 10 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5, delay: 0.1 }}
        className="mt-4 text-3xl font-semibold tracking-tight text-ink md:text-4xl"
      >
        {showcase.title}
      </motion.h2>
      <motion.p
        initial={{ opacity: 0, y: 10 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5, delay: 0.2 }}
        className="mt-4 max-w-xl text-ink-muted"
      >
        {showcase.subtitle}
      </motion.p>

      <motion.figure
        initial={{ opacity: 0, y: 20, scale: 0.98 }}
        whileInView={{ opacity: 1, y: 0, scale: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6, delay: 0.3 }}
        className="mt-12 w-full max-w-5xl overflow-hidden rounded-[2rem] border border-stroke/40 bg-surface shadow-2xl shadow-accent/5"
      >
        <video
          className="h-auto w-full object-cover"
          loop
          muted
          playsInline
          preload="metadata"
          poster={posterSrc}
          data-play-on-view="true"
          aria-label="Trail product demo"
        >
          <source src={videoSrc} type="video/mp4" />
          <track
            kind="captions"
            srcLang="en"
            src={captionsSrc}
            label="English captions"
            default
          />
        </video>
      </motion.figure>
    </section>
  );
}
