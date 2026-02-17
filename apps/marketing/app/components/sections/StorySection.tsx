"use client";

import { motion } from "motion/react";
import { PortableText, type PortableTextComponents } from "@portabletext/react";
import {
  PageSection,
  SectionContainer,
  SurfaceCard,
} from "../../shared/marketing-primitives";

const components: PortableTextComponents = {
  block: {
    normal: ({ children }) => (
      <p className="text-ink-muted">{children}</p>
    ),
  },
};

interface StorySectionProps {
  title?: string;
  body?: any[];
}

export function StorySection({ title, body }: StorySectionProps) {
  return (
    <PageSection spacing="spacious">
      <SectionContainer size="md">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          <SurfaceCard className="p-8 md:p-12">
            {title && (
              <h2 className="text-2xl font-semibold text-ink">{title}</h2>
            )}
            {body && (
              <div className="mt-6 space-y-4">
                <PortableText value={body} components={components} />
              </div>
            )}
          </SurfaceCard>
        </motion.div>
      </SectionContainer>
    </PageSection>
  );
}
