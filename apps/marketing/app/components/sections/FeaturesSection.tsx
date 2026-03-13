"use client";

import {
  Camera,
  Eye,
  Share2,
  Palette,
  type LucideIcon,
} from "lucide-react";
import { Reveal } from "../ui/reveal";
import { Stagger, StaggerItem } from "../ui/stagger";
import { parseHeadline } from "../ui/parse-headline";
import type { BentoFeaturesSectionData, BentoFeature } from "../../../lib/sanity/types";

const iconMap: Record<string, LucideIcon> = {
  capture: Camera,
  visualize: Eye,
  share: Share2,
  customize: Palette,
};

export function FeaturesSection({ section }: { section: BentoFeaturesSectionData }) {
  const features: BentoFeature[] = section.features ?? [];

  return (
    <section id="features" className="py-24 sm:py-32">
      <div className="mx-auto max-w-5xl px-6">
        {section.eyebrow && (
          <Reveal delay={0.1}>
            <span className="inline-flex rounded-full border border-gold/20 bg-gold-subtle px-3 py-1 text-xs tracking-label uppercase text-gold">
              {section.eyebrow}
            </span>
          </Reveal>
        )}

        {section.title && (
          <Reveal delay={0.2}>
            <h2 className="tracking-heading mt-6 text-3xl font-bold leading-tight sm:text-4xl md:text-5xl">
              {parseHeadline(section.title)}
            </h2>
          </Reveal>
        )}

        {section.summary && (
          <Reveal delay={0.3}>
            <p className="tracking-body mt-4 max-w-2xl text-lg text-text-secondary">
              {section.summary}
            </p>
          </Reveal>
        )}

        <Stagger
          className="mt-12 grid gap-6 sm:grid-cols-2"
          delay={0.4}
          staggerInterval={0.1}
        >
          {features.map((feature) => {
            const Icon = iconMap[feature.id ?? ""] ?? Camera;
            return (
              <StaggerItem key={feature._key ?? feature.id}>
                <div className="group relative rounded-xl border border-border-subtle bg-surface p-6 transition-all duration-200 hover:border-border-strong hover:bg-elevated hover:shadow-[0_4px_32px_rgba(212,22,108,0.08)] sm:p-8">
                  <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-elevated text-text-secondary transition-colors group-hover:text-magenta">
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="tracking-heading text-lg font-semibold text-text-primary">
                    {feature.name}
                  </h3>
                  <p className="tracking-body mt-2 text-sm text-text-secondary leading-relaxed">
                    {feature.description}
                  </p>
                </div>
              </StaggerItem>
            );
          })}
        </Stagger>
      </div>
    </section>
  );
}
