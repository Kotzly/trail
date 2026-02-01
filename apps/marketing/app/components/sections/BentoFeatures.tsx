"use client";

import { ReactNode, useEffect, useRef, useState } from "react";
import { ArrowRightIcon } from "@radix-ui/react-icons";
import { motion } from "framer-motion";
import { marketingCopy } from "@trail/content";
import { GlowingEffect } from "../ui/glowing-effect";
import { Button } from "../ui/button";

// Feature preview components
const CapturePreview = () => (
  <div className="flex items-center justify-center gap-2">
    <div className="preview-dot h-2 w-2 rounded-full bg-accent" />
    <div className="preview-dot h-2 w-2 rounded-full bg-accent/70" />
    <div className="preview-dot h-2 w-2 rounded-full bg-accent/50" />
    <svg
      className="ml-2 h-4 w-4 text-accent"
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
  </div>
);

const SearchPreview = () => (
  <div className="flex items-center gap-2">
    <div className="search-ring relative flex h-8 w-8 items-center justify-center rounded-full border-2 border-accent/50">
      <svg
        className="h-4 w-4 text-accent"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <circle cx="11" cy="11" r="8" />
        <path d="m21 21-4.35-4.35" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
    <div className="flex items-center text-xs text-ink-muted">
      <span>find anything</span>
      <span className="search-cursor ml-0.5 inline-block h-3.5 w-0.5 bg-accent" />
    </div>
  </div>
);

const ViewsPreview = () => (
  <div className="relative flex h-12 w-12 items-center justify-center">
    <div
      className="view-shape absolute h-3 w-3 rounded bg-accent/80"
      style={{ top: "20%", left: "30%" }}
    />
    <div
      className="view-shape absolute h-3 w-3 rounded bg-accent/60"
      style={{ top: "50%", left: "60%" }}
    />
    <div
      className="view-shape absolute h-3 w-3 rounded bg-accent/40"
      style={{ top: "70%", left: "25%" }}
    />
    <svg
      className="absolute inset-0 h-full w-full text-accent/30"
      viewBox="0 0 48 48"
      fill="none"
      stroke="currentColor"
      strokeWidth="1"
    >
      <circle cx="24" cy="24" r="16" strokeDasharray="4 4" />
    </svg>
  </div>
);

const SharePreview = () => (
  <div className="share-pulse-ring relative flex h-10 w-10 items-center justify-center rounded-full">
    <svg
      className="share-icon-link h-5 w-5 text-accent"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path
        d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  </div>
);

const ExportPreview = () => (
  <div className="flex flex-col items-center gap-1.5">
    <div className="relative flex h-8 w-8 items-center justify-center rounded-lg border border-accent/50 bg-accent/10">
      <svg
        className="export-arrow h-4 w-4 text-accent"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <path
          d="M12 5v14M5 12l7 7 7-7"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
    <div className="h-1 w-16 overflow-hidden rounded-full bg-accent/20">
      <div className="export-progress-bar h-full bg-accent/60" />
    </div>
  </div>
);

const featurePreviews: Record<string, ReactNode> = {
  capture: <CapturePreview />,
  search: <SearchPreview />,
  views: <ViewsPreview />,
  share: <SharePreview />,
  polish: <ExportPreview />,
};

// Feature icons
const CaptureIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <circle cx="12" cy="12" r="10" />
    <circle cx="12" cy="12" r="3" fill="currentColor" />
  </svg>
);

const SearchIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <circle cx="11" cy="11" r="8" />
    <path d="m21 21-4.35-4.35" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const ViewsIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <rect x="3" y="3" width="7" height="7" rx="1" />
    <rect x="14" y="3" width="7" height="7" rx="1" />
    <rect x="3" y="14" width="7" height="7" rx="1" />
    <rect x="14" y="14" width="7" height="7" rx="1" />
  </svg>
);

const ShareIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <circle cx="18" cy="5" r="3" />
    <circle cx="6" cy="12" r="3" />
    <circle cx="18" cy="19" r="3" />
    <path d="M8.59 13.51 15.42 17.49" strokeLinecap="round" />
    <path d="M15.41 6.51 8.59 10.49" strokeLinecap="round" />
  </svg>
);

const ExportIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M7 10 12 15 17 10" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M12 15V3" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const featureIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  capture: CaptureIcon,
  search: SearchIcon,
  views: ViewsIcon,
  share: ShareIcon,
  polish: ExportIcon,
};

interface BentoCardProps {
  name: string;
  className: string;
  Icon: React.ComponentType<{ className?: string }>;
  description: string;
  href: string;
  cta: string;
  id?: string;
  index?: number;
}

function BentoCard({ name, className, Icon, description, href, cta, id = "", index = 0 }: BentoCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.unobserve(entry.target);
        }
      },
      { threshold: 0.15, rootMargin: "0px 0px -50px 0px" }
    );

    if (cardRef.current) {
      observer.observe(cardRef.current);
    }

    return () => observer.disconnect();
  }, []);

  const preview = id ? featurePreviews[id] : null;
  const delay = index * 100;

  return (
    <motion.div
      ref={cardRef}
      initial={{ opacity: 0, y: 24 }}
      animate={isVisible ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.5, delay: delay / 1000, ease: [0.16, 1, 0.3, 1] }}
      className={className}
    >
      <div className="group relative h-full overflow-hidden rounded-3xl border border-stroke/60 bg-surface/70 transition-all duration-300 hover:border-accent/40 hover:shadow-xl hover:shadow-accent/5">
        <GlowingEffect
          spread={40}
          glow={true}
          disabled={false}
          proximity={64}
          inactiveZone={0.01}
          borderWidth={2}
        />
        
        <div className="relative flex h-full flex-col justify-between p-6">
          <div className="space-y-4">
            <div className="flex items-start justify-between">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-stroke/60 bg-surface-strong/50 transition-colors group-hover:border-accent/30 group-hover:bg-accent/5">
                <Icon className="h-6 w-6 text-ink transition-colors group-hover:text-accent" />
              </div>
              
              {preview && (
                <div className="opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                  {preview}
                </div>
              )}
            </div>
            
            <div>
              <h3 className="text-xl font-semibold text-ink">{name}</h3>
              <p className="mt-2 max-w-[280px] text-sm leading-relaxed text-ink-muted">
                {description}
              </p>
            </div>
          </div>

          <Button.AsChild variant="ghost" size="sm" className="mt-4 w-fit opacity-0 transition-all duration-300 group-hover:opacity-100">
            <a href={href} className="flex items-center gap-1 text-accent">
              {cta}
              <ArrowRightIcon className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </a>
          </Button.AsChild>
        </div>
      </div>
    </motion.div>
  );
}

export function BentoFeatures() {
  const { features } = marketingCopy;

  return (
    <section id="features" className="relative px-6 py-24">
      {/* Section header */}
      <div className="mx-auto max-w-6xl text-center">
        <motion.span
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="inline-block text-xs font-semibold uppercase tracking-wider text-accent"
        >
          {features.eyebrow}
        </motion.span>
        <motion.h2
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="mt-4 text-3xl font-semibold tracking-tight text-ink md:text-4xl"
        >
          {features.title}
        </motion.h2>
        <motion.p
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="mx-auto mt-4 max-w-2xl text-ink-muted"
        >
          {features.summary}
        </motion.p>
      </div>

      {/* Bento grid */}
      <div className="mx-auto mt-16 max-w-6xl">
        <div className="grid auto-rows-[200px] grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 lg:grid-rows-3">
          {features.items.map((feature, index) => (
            <BentoCard
              key={feature.id}
              name={feature.name}
              description={feature.description}
              href={feature.href}
              cta={feature.cta}
              Icon={featureIcons[feature.id] || CaptureIcon}
              id={feature.id}
              index={index}
              className={feature.className}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
