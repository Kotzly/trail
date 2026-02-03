"use client";

import Image from "next/image";
import { motion } from "motion/react";
import videosData from "../../data/videos.json";

const VideoShowcases = () => {
  const { title, sections } = videosData;

  return (
    <section id="make-trail-yours" className="px-6 py-24 lg:py-32 overflow-hidden">
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
}

export default VideoShowcases;

interface Section {
  eyebrow: string;
  title: string;
  description: string;
  image: string;
  imageAlt: string;
}

function FeatureBlock({
  section,
  reversed,
  index,
}: {
  section: Section;
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
        reversed ? "lg:grid-cols-[1fr_1.1fr]" : "lg:grid-cols-[1.1fr_1fr]"
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
          className="text-3xl sm:text-4xl lg:text-5xl font-semibold text-ink leading-[1.1] whitespace-pre-line"
        >
          {section.title}
        </motion.h3>
        
        <motion.p 
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="text-lg text-ink-muted leading-relaxed max-w-md"
        >
          {section.description}
        </motion.p>
      </div>

      {/* Image - Square, Larger, Thinner Border */}
      <motion.div 
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-100px" }}
        transition={{ duration: 0.8, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
        className={`relative isolate ${reversed ? "lg:order-1" : "lg:order-2"}`}
      >
        {/* Larger square container with thin border */}
        <div className="relative aspect-square w-full max-w-lg mx-auto rounded-[2rem] overflow-hidden bg-gradient-to-br from-accent/20 via-surface to-cta/20 p-[1px] shadow-2xl shadow-accent/5">
          <div className="absolute inset-0 rounded-[2rem] bg-gradient-to-br from-accent/30 via-transparent to-cta/20 opacity-60" />
          <div className="relative w-full h-full rounded-[calc(2rem-1px)] overflow-hidden bg-surface">
            <Image
              src={section.image}
              alt={section.imageAlt}
              fill
              className="object-cover"
              sizes="(max-width: 768px) 100vw, 512px"
            />
          </div>
        </div>
        {/* Decorative gradient blur */}
        <div className={`absolute -inset-8 -z-10 ${reversed ? "bg-gradient-to-br" : "bg-gradient-to-bl"} from-accent/20 via-cta/10 to-transparent blur-3xl opacity-50`} />
      </motion.div>
    </motion.div>
  );
}
