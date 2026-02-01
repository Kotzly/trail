"use client";

import { motion } from "framer-motion";
import Image from "next/image";
import { marketingCopy } from "@trail/content";
import { GlowingEffect } from "../ui/glowing-effect";

// Icons
const PaletteIcon = () => (
  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="12" cy="12" r="10" />
    <path d="M12 2a10 10 0 0 1 10 10" strokeLinecap="round" />
    <path d="M12 12 4.5 6.5" strokeLinecap="round" />
    <path d="M12 12v10" strokeLinecap="round" />
  </svg>
);

const WandIcon = () => (
  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="m21.64 3.64-1.28-1.28a1.21 1.21 0 0 0-1.72 0L2.36 18.64a1.21 1.21 0 0 0 0 1.72l1.28 1.28a1.2 1.2 0 0 0 1.72 0L21.64 5.36a1.2 1.2 0 0 0 0-1.72" strokeLinecap="round" strokeLinejoin="round" />
    <path d="m14 7 3 3" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M5 6v4" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M19 14v4" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M10 2v2" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M7 8H5" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M16 16h2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const LayoutIcon = () => (
  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect width="18" height="18" x="3" y="3" rx="2" />
    <path d="M3 9h18" strokeLinecap="round" />
    <path d="M9 21V9" strokeLinecap="round" />
  </svg>
);

const SparklesIcon = () => (
  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275z" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M5 3v4" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M19 17v4" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M3 5h4" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M17 19h4" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const ShareIcon = () => (
  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="18" cy="5" r="3" />
    <circle cx="6" cy="12" r="3" />
    <circle cx="18" cy="19" r="3" />
    <path d="M8.59 13.51 15.42 17.49" strokeLinecap="round" />
    <path d="M15.41 6.51 8.59 10.49" strokeLinecap="round" />
  </svg>
);

const iconMap: Record<string, React.ReactNode> = {
  palette: <PaletteIcon />,
  wand: <WandIcon />,
  layout: <LayoutIcon />,
  sparkles: <SparklesIcon />,
  share: <ShareIcon />,
};

interface GridItemProps {
  area: string;
  icon: React.ReactNode;
  title: string;
  description: string;
}

function GridItem({ area, icon, title, description }: GridItemProps) {
  return (
    <li className={`min-h-[14rem] list-none ${area}`}>
      <div className="group relative h-full rounded-[1.5rem] border border-stroke/60 bg-surface/50 p-2 transition-all duration-300 hover:border-accent/40 hover:shadow-xl hover:shadow-accent/5">
        <GlowingEffect
          spread={40}
          glow={true}
          disabled={false}
          proximity={64}
          inactiveZone={0.01}
          borderWidth={2}
        />
        <div className="relative flex h-full flex-col justify-between gap-6 overflow-hidden rounded-xl border border-stroke/40 bg-surface/80 p-6">
          <div className="relative flex flex-1 flex-col justify-between gap-3">
            <div className="w-fit rounded-xl border border-stroke/60 bg-surface-strong/50 p-2.5 text-ink transition-colors group-hover:border-accent/30 group-hover:text-accent">
              {icon}
            </div>
            <div className="space-y-2">
              <h3 className="text-lg font-semibold text-ink md:text-xl">
                {title}
              </h3>
              <p className="text-sm leading-relaxed text-ink-muted">
                {description}
              </p>
            </div>
          </div>
        </div>
      </div>
    </li>
  );
}

export function PersonalizationSection() {
  const { personalization } = marketingCopy;

  return (
    <section id="make-trail-yours" className="relative overflow-hidden px-6 py-24">
      {/* Background gradient */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/2 top-1/2 h-[800px] w-[800px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent/3 blur-3xl" />
      </div>

      <div className="relative mx-auto max-w-6xl">
        {/* Section header */}
        <div className="text-center">
          <motion.span
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="inline-block text-xs font-semibold uppercase tracking-wider text-accent"
          >
            {personalization.eyebrow}
          </motion.span>
          <motion.h2
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="mt-4 text-3xl font-semibold tracking-tight text-ink md:text-4xl"
          >
            {personalization.title}
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="mx-auto mt-4 max-w-2xl text-ink-muted"
          >
            {personalization.summary}
          </motion.p>
        </div>

        {/* Content grid with videos/images */}
        <div className="mt-16 grid gap-8 lg:grid-cols-[1fr_1.5fr_1fr]">
          {/* Left column - images */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="hidden flex-col gap-4 lg:flex"
          >
            {personalization.videos.left.map((item, index) => (
              <div
                key={index}
                className="group relative overflow-hidden rounded-2xl border border-stroke/40 bg-surface/50 transition-all hover:border-accent/30 hover:shadow-lg"
              >
                <div className="aspect-[16/10] relative">
                  <Image
                    src={item.src}
                    alt={item.alt}
                    fill
                    className="object-cover transition-transform duration-500 group-hover:scale-105"
                    sizes="(max-width: 1024px) 100vw, 33vw"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-surface/80 via-transparent to-transparent" />
                </div>
                <div className="p-4">
                  <h4 className="font-medium text-ink">{item.title}</h4>
                  <p className="text-sm text-ink-subtle">{item.description}</p>
                </div>
              </div>
            ))}
          </motion.div>

          {/* Center - Grid items */}
          <motion.ul
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="grid grid-cols-1 grid-rows-none gap-4 md:grid-cols-12 md:grid-rows-3"
          >
            {personalization.cards.map((card, index) => (
              <GridItem
                key={index}
                area={card.layout}
                icon={iconMap[card.icon]}
                title={card.title}
                description={card.description}
              />
            ))}
          </motion.ul>

          {/* Right column - images */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="hidden flex-col gap-4 lg:flex"
          >
            {personalization.videos.right.map((item, index) => (
              <div
                key={index}
                className="group relative overflow-hidden rounded-2xl border border-stroke/40 bg-surface/50 transition-all hover:border-accent/30 hover:shadow-lg"
              >
                <div className="aspect-[16/10] relative">
                  <Image
                    src={item.src}
                    alt={item.alt}
                    fill
                    className="object-cover transition-transform duration-500 group-hover:scale-105"
                    sizes="(max-width: 1024px) 100vw, 33vw"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-surface/80 via-transparent to-transparent" />
                </div>
                <div className="p-4">
                  <h4 className="font-medium text-ink">{item.title}</h4>
                  <p className="text-sm text-ink-subtle">{item.description}</p>
                </div>
              </div>
            ))}
          </motion.div>
        </div>

        {/* Mobile images - shown only on smaller screens */}
        <div className="mt-8 grid grid-cols-2 gap-4 lg:hidden">
          {[...personalization.videos.left, ...personalization.videos.right].slice(0, 2).map((item, index) => (
            <div
              key={index}
              className="group relative overflow-hidden rounded-2xl border border-stroke/40 bg-surface/50"
            >
              <div className="aspect-[16/10] relative">
                <Image
                  src={item.src}
                  alt={item.alt}
                  fill
                  className="object-cover"
                  sizes="50vw"
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
