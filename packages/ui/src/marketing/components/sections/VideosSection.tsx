"use client";

import Image from "next/image";
import { motion } from "motion/react";

export interface VideoSection {
  eyebrow: string;
  title: string;
  description: string;
  video: string;
  preview: string;
}

export interface VideosSectionContent {
  title: string;
  sections: VideoSection[];
}

interface VideosSectionProps {
  content: VideosSectionContent;
}

const VideoShowcases = ({ content }: VideosSectionProps) => {
  const { title, sections } = content;

  return (
    <section
      id="make-trail-yours"
      className="px-6 py-24 lg:py-32 overflow-hidden"
    >
      <div className="mx-auto max-w-6xl">
        {/* Section Title */}
        <motion.h2
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          className="text-center text-3xl sm:text-4xl md:text-5xl font-semibold tracking-tight text-ink mb-24 lg:mb-32"
        >
          {title}
        </motion.h2>

        {/* Feature Sections - Alternating Layout */}
        <div className="space-y-32 lg:space-y-48">
          {sections.map((section, index) => (
            <FeatureBlock
              key={index}
              section={section}
              reversed={index % 2 === 1}
              index={index}
            />
          ))}
        </div>
      </div>
    </section>
  );
};

export default VideoShowcases;

function FeatureBlock({
  section,
  reversed,
  index,
}: {
  section: VideoSection;
  reversed: boolean;
  index: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      whileInView={{ opacity: 1 }}
      viewport={{ once: true, margin: "-100px" }}
      transition={{ duration: 0.6 }}
      className={`grid gap-16 lg:gap-24 items-center ${
        reversed
          ? "lg:grid-cols-[1.25fr_0.85fr]"
          : "lg:grid-cols-[0.85fr_1.25fr]"
      }`}
    >
      {/* Text Content */}
      <div className={`space-y-6 ${reversed ? "lg:order-2" : "lg:order-1"}`}>
        <motion.span
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="inline-block text-sm font-medium text-accent uppercase tracking-wider"
        >
          {section.eyebrow}
        </motion.span>

        <motion.h3
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="text-3xl font-semibold text-ink leading-[1.1] whitespace-pre-line"
        >
          {section.title}
        </motion.h3>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="text-md text-ink-muted leading-relaxed max-w-sm"
        >
          {section.description}
        </motion.p>
      </div>

      {/* Video - 4:3 Aspect Ratio and Fill Container */}
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-100px" }}
        transition={{ duration: 0.8, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
        className={`relative isolate ${reversed ? "lg:order-1" : "lg:order-2"}`}
      >
        {/* 4:3 aspect-ratio container */}
        <div className="relative aspect-[4/3] w-full h-full rounded-[2.5rem] overflow-hidden bg-gradient-to-br from-accent/20 via-surface to-cta/20 p-[2px] shadow-2xl shadow-accent/5">
          <div className="absolute inset-0 rounded-[2.5rem] bg-gradient-to-br from-accent/30 via-transparent to-cta/20 opacity-60" />
          <div className="relative w-full h-full rounded-[calc(2.5rem-2px)] overflow-hidden bg-surface">
            <video
              className="absolute top-0 left-0 w-full h-full object-cover"
              style={{ aspectRatio: "4/3" }}
              loop
              muted
              playsInline
              preload="metadata"
              poster={section.preview}
              data-play-on-view="true"
              aria-label="Trail product demo"
            >
              <source src={section.video} type="video/mp4" />
            </video>
          </div>
        </div>
        {/* Decorative gradient blur */}
        <div
          className={`absolute -inset-8 -z-10 ${reversed ? "bg-gradient-to-br" : "bg-gradient-to-bl"} from-accent/20 via-cta/10 to-transparent blur-3xl opacity-50`}
        />
      </motion.div>
    </motion.div>
  );
}
