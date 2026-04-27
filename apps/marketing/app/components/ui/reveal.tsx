"use client";

import { motion, type Variants } from "motion/react";
import { type ReactNode } from "react";

const easeOut = [0.23, 1, 0.32, 1] as const;

function makeRevealVariants(delay: number): Variants {
  return {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.6,
        ease: easeOut,
        delay,
      },
    },
  };
}

export function Reveal({
  children,
  className,
  delay = 0,
  width = "100%",
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
  width?: string;
}) {
  return (
    <motion.div
      variants={makeRevealVariants(delay)}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: "-80px" }}
      className={className}
      style={{ width }}
    >
      {children}
    </motion.div>
  );
}

export function RevealChild({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <motion.div
      variants={{
        hidden: { opacity: 0, y: 20 },
        visible: {
          opacity: 1,
          y: 0,
          transition: { duration: 0.6, ease: easeOut },
        },
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
