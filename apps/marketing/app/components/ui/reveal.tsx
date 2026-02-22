"use client";

import { motion, type Variants } from "motion/react";
import { type ReactNode } from "react";

function makeRevealVariants(delay: number): Variants {
  return {
    hidden: { filter: "blur(10px)", opacity: 0, y: 24 },
    visible: {
      filter: "blur(0px)",
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.7,
        ease: [0.25, 0.1, 0.25, 1],
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
        hidden: { filter: "blur(10px)", opacity: 0, y: 24 },
        visible: {
          filter: "blur(0px)",
          opacity: 1,
          y: 0,
          transition: { duration: 0.7, ease: [0.25, 0.1, 0.25, 1] },
        },
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
