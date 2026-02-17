"use client";

import { motion } from "motion/react";
import {
  HeroBadge,
  HeroSubtitle,
  HeroTitle,
  PageSection,
  SectionContainer,
} from "../../shared/marketing-primitives";

interface PageHeaderProps {
  eyebrow?: string;
  title?: string;
  description?: string;
}

export function PageHeader({ eyebrow, title, description }: PageHeaderProps) {
  return (
    <PageSection spacing="hero">
      <SectionContainer size="md" className="text-center">
        {eyebrow && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <HeroBadge>{eyebrow}</HeroBadge>
          </motion.div>
        )}

        {title && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
          >
            <HeroTitle className="md:text-5xl lg:text-5xl">{title}</HeroTitle>
          </motion.div>
        )}

        {description && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            <HeroSubtitle>{description}</HeroSubtitle>
          </motion.div>
        )}
      </SectionContainer>
    </PageSection>
  );
}
