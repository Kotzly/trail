"use client";

import { motion } from "motion/react";
import {
  PageSection,
  SectionContainer,
  SurfaceCard,
} from "../../shared/marketing-primitives";

interface StatsSectionProps {
  title?: string;
  stats?: { value: string; label: string }[];
}

export function StatsSection({ title, stats }: StatsSectionProps) {
  if (!stats?.length) return null;
  return (
    <PageSection spacing="compact">
      <SectionContainer size="lg">
        {title && (
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mb-8 text-center text-2xl font-semibold text-ink md:text-3xl"
          >
            {title}
          </motion.h2>
        )}
        <div className="grid grid-cols-2 gap-6 md:grid-cols-4">
          {stats.map((stat) => (
            <SurfaceCard key={stat.label} className="p-6 text-center">
              <div className="text-3xl font-bold text-ink md:text-4xl">
                {stat.value}
              </div>
              <div className="mt-1 text-sm text-ink-subtle">{stat.label}</div>
            </SurfaceCard>
          ))}
        </div>
      </SectionContainer>
    </PageSection>
  );
}
