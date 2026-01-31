"use client";

import * as React from "react";
import Image from "next/image";
import { motion, useReducedMotion } from "framer-motion";
import { cn } from "@trail/ui";

export interface Testimonial {
  text: string;
  image: string;
  name: string;
  role: string;
}

export const TestimonialsColumn = ({
  className,
  testimonials,
  duration = 12
}: {
  className?: string;
  testimonials: Testimonial[];
  duration?: number;
}) => {
  const reduceMotion = useReducedMotion();
  const rows = reduceMotion ? 1 : 2;

  return (
    <div className={className}>
      <motion.div
        animate={reduceMotion ? undefined : { translateY: "-50%" }}
        transition={
          reduceMotion
            ? undefined
            : {
                duration,
                repeat: Infinity,
                ease: "linear",
                repeatType: "loop"
              }
        }
        className="flex flex-col gap-6 pb-6"
      >
        {[...new Array(rows).fill(0)].map((_, index) => (
          <React.Fragment key={index}>
            {testimonials.map(({ text, image, name, role }, i) => (
                <div
                  className={cn(
                  "max-w-xs rounded-3xl border border-border/60 bg-surface p-6"
                  )}
                  key={`${name}-${i}`}
                >
                <p className="text-sm text-ink">{text}</p>
                <div className="mt-5 flex items-center gap-3">
                  <Image
                    width={40}
                    height={40}
                    src={image}
                    alt={name}
                    className="h-10 w-10 rounded-full object-cover"
                    sizes="40px"
                  />
                  <div className="flex flex-col">
                    <span className="text-sm font-semibold text-ink">{name}</span>
                    <span className="text-xs text-ink-subtle">{role}</span>
                  </div>
                </div>
              </div>
            ))}
          </React.Fragment>
        ))}
      </motion.div>
    </div>
  );
};
