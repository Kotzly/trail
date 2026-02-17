"use client";

import { motion } from "motion/react";
import {
  PageSection,
  SectionContainer,
  SurfaceCard,
} from "../../shared/marketing-primitives";

interface TimelineSectionProps {
  title?: string;
  subtitle?: string;
  items?: {
    year: string;
    heading?: string;
    description?: string;
    highlights?: string[];
    image?: { asset?: { url?: string } };
  }[];
}

export function TimelineSection({
  title,
  subtitle,
  items,
}: TimelineSectionProps) {
  if (!items?.length) return null;
  return (
    <PageSection spacing="spacious">
      <SectionContainer size="lg">
        {(title || subtitle) && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mb-16 text-center"
          >
            {title && (
              <h2 className="text-2xl font-semibold text-ink md:text-3xl">
                {title}
              </h2>
            )}
            {subtitle && (
              <p className="mx-auto mt-4 max-w-2xl text-ink-muted">
                {subtitle}
              </p>
            )}
          </motion.div>
        )}
        <div className="relative space-y-12">
          <div className="absolute left-4 top-0 bottom-0 hidden w-px bg-stroke/40 md:block" />
          {items.map((item, index) => (
            <motion.div
              key={item.year}
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              className="md:pl-12"
            >
              <div className="hidden md:block absolute left-2.5 mt-1.5 h-3 w-3 rounded-full border-2 border-accent bg-base" />
              <SurfaceCard className="p-6">
                <span className="text-sm font-semibold text-accent">
                  {item.year}
                </span>
                {item.heading && (
                  <h3 className="mt-2 text-lg font-semibold text-ink">
                    {item.heading}
                  </h3>
                )}
                {item.description && (
                  <p className="mt-2 text-sm text-ink-muted">
                    {item.description}
                  </p>
                )}
                {item.highlights?.length ? (
                  <ul className="mt-4 space-y-1">
                    {item.highlights.map((h) => (
                      <li
                        key={h}
                        className="flex items-center gap-2 text-sm text-ink-muted"
                      >
                        <span className="h-1.5 w-1.5 rounded-full bg-accent" />
                        {h}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </SurfaceCard>
            </motion.div>
          ))}
        </div>
      </SectionContainer>
    </PageSection>
  );
}
