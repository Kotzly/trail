"use client";

import { motion } from "motion/react";
import { CheckCircle2 } from "@trail/ui/icons";
import {
  PageSection,
  SectionContainer,
  SurfaceCard,
} from "../../shared/marketing-primitives";

interface InfoColumnsSectionProps {
  title?: string;
  columns?: { title: string; items: string[] }[];
}

export function InfoColumnsSection({ title, columns }: InfoColumnsSectionProps) {
  if (!columns?.length) return null;
  return (
    <PageSection spacing="spacious">
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
        <div className={`grid gap-6 md:grid-cols-${columns.length}`}>
          {columns.map((col, index) => (
            <motion.div
              key={col.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
            >
              <SurfaceCard className="p-6">
                <h3 className="text-lg font-semibold text-ink">{col.title}</h3>
                <ul className="mt-4 space-y-3">
                  {col.items?.map((item) => (
                    <li key={item} className="flex items-start gap-2 text-sm text-ink-muted">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green-500" />
                      {item}
                    </li>
                  ))}
                </ul>
              </SurfaceCard>
            </motion.div>
          ))}
        </div>
      </SectionContainer>
    </PageSection>
  );
}
