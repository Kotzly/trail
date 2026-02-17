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
    status?: "completed" | "in_progress" | "planned" | "future";
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
              <div
                className={`hidden md:block absolute left-2.5 mt-1.5 h-3 w-3 rounded-full border-2 ${
                  item.status === "completed"
                    ? "border-green-500 bg-green-500"
                    : item.status === "in_progress"
                      ? "border-accent bg-accent"
                      : "border-stroke bg-base"
                }`}
              />
              <SurfaceCard className="p-6">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-accent">
                    {item.year}
                  </span>
                  {item.status && (
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                        item.status === "completed"
                          ? "bg-green-500/10 text-green-600"
                          : item.status === "in_progress"
                            ? "bg-accent/10 text-accent"
                            : item.status === "planned"
                              ? "bg-amber-500/10 text-amber-600"
                              : "bg-ink-subtle/10 text-ink-subtle"
                      }`}
                    >
                      {item.status === "completed"
                        ? "Done"
                        : item.status === "in_progress"
                          ? "In Progress"
                          : item.status === "planned"
                            ? "Planned"
                            : "Future"}
                    </span>
                  )}
                </div>
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
