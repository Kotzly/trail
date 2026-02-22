"use client";

import { motion } from "motion/react";
import { type ReactNode } from "react";

export function Stagger({
  children,
  className,
  delay = 0,
  staggerInterval = 0.12,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
  staggerInterval?: number;
}) {
  return (
    <motion.div
      variants={{
        hidden: {},
        visible: {
          transition: {
            staggerChildren: staggerInterval,
            delayChildren: delay,
          },
        },
      }}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: "-80px" }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

export function StaggerItem({
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
