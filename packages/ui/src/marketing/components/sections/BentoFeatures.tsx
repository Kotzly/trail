"use client";

import { ReactNode, useEffect, useRef, useState } from "react";
import { ArrowRightIcon } from "@radix-ui/react-icons";
import { motion } from "motion/react";
import { marketingCopy } from "@trail/content";
import { GlowingEffect } from "../ui/glowing-effect";
import { Button } from "../ui/button";
import {
  MousePointerClick,
  Search,
  GitBranch,
  Share2,
  FileDown,
  ArrowRight,
  Palette,
  LucideCircleSlash,
  ArrowLeft,
  Brush,
} from "lucide-react";

const featureIcons: Record<
  string,
  React.ComponentType<{ className?: string }>
> = {
  capture: MousePointerClick,
  search: Search,
  views: GitBranch,
  share: Share2,
  polish: FileDown,
  customization: Palette,
};

const CapturePreview = () => (
  <div className="flex items-center justify-center gap-2">
    <div className="preview-dot h-2 w-2 rounded-full bg-accent animate-pulse" />
    <div
      className="preview-dot h-2 w-2 rounded-full bg-accent/70"
      style={{ animationDelay: "0.1s" }}
    />
    <div
      className="preview-dot h-2 w-2 rounded-full bg-accent/50"
      style={{ animationDelay: "0.2s" }}
    />
    <ArrowRight className="ml-2 h-4 w-4 text-accent" />
  </div>
);

const SearchPreview = () => (
  <div className="flex items-center gap-2">
    <div className="relative flex h-8 w-8 items-center justify-center rounded-full border-2 border-accent/50">
      <Search className="h-4 w-4 text-accent" />
    </div>
    <div className="flex items-center text-xs text-ink-muted">
      <span>find anything</span>
      <span className="ml-0.5 inline-block h-3.5 w-0.5 bg-accent animate-pulse" />
    </div>
  </div>
);

const ViewsPreview = () => (
  <div className="relative flex h-12 w-12 items-center justify-center">
    <div
      className="absolute h-3 w-3 rounded bg-accent/80"
      style={{ top: "20%", left: "30%" }}
    />
    <div
      className="absolute h-3 w-3 rounded bg-accent/60"
      style={{ top: "50%", left: "60%" }}
    />
    <div
      className="absolute h-3 w-3 rounded bg-accent/40"
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
  <div className="relative flex h-10 w-10 items-center justify-center rounded-full">
    <Share2 className="h-5 w-5 text-accent" />
  </div>
);

const ExportPreview = () => (
  <div className="flex flex-col items-center gap-1.5">
    <div className="relative flex h-8 w-8 items-center justify-center rounded-lg border border-accent/50 bg-accent/10">
      <FileDown className="h-4 w-4 text-accent" />
    </div>
    <div className="h-1 w-16 overflow-hidden rounded-full bg-accent/20">
      <div className="h-full w-2/3 bg-accent/60" />
    </div>
  </div>
);

const CustomizationPreview = () => (
  <div className="relative flex h-10 w-10 items-center justify-center rounded-full">
    <Brush className="h-5 w-5 text-accent" />
  </div>
);

const featurePreviews: Record<string, ReactNode> = {
  capture: <CapturePreview />,
  search: <SearchPreview />,
  views: <ViewsPreview />,
  share: <SharePreview />,
  polish: <ExportPreview />,
  customization: <CustomizationPreview />,
};

interface BentoCardProps {
  name: string;
  Icon: React.ComponentType<{ className?: string }>;
  description: string;
  href: string;
  cta: string;
  id?: string;
  index?: number;
  className?: string;
}

function BentoCard({
  name,
  Icon,
  description,
  href,
  cta,
  id = "",
  index = 0,
  className = "",
}: BentoCardProps) {
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
      { threshold: 0.15, rootMargin: "0px 0px -50px 0px" },
    );

    if (cardRef.current) {
      observer.observe(cardRef.current);
    }

    return () => observer.disconnect();
  }, []);

  const preview = id ? featurePreviews[id] : null;

  return (
    <motion.div
      ref={cardRef}
      initial={{ opacity: 0, y: 24 }}
      animate={isVisible ? { opacity: 1, y: 0 } : {}}
      transition={{
        duration: 0.5,
        delay: index * 0.1,
        ease: [0.16, 1, 0.3, 1],
      }}
      className={`h-full ${className}`}
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

          <Button.AsChild
            variant="ghost"
            size="sm"
            className="mt-4 w-fit opacity-0 transition-all duration-300 group-hover:opacity-100"
          >
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

      <div className="mx-auto mt-16 max-w-6xl">
        <div className="grid auto-rows-[200px] grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 lg:grid-rows-3">
          {features.items.map((feature, index) => (
            <BentoCard
              key={feature.id}
              name={feature.name}
              description={feature.description}
              href={feature.href}
              cta={feature.cta}
              Icon={featureIcons[feature.id] || MousePointerClick}
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
