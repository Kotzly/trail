"use client";

import React from "react";
import { motion } from "framer-motion";
import Image from "next/image";

export interface Testimonial {
  quote: string;
  image: string;
  name: string;
  role: string;
  link?: string;
}

export const TestimonialsColumn = (props: {
  className?: string;
  testimonials: Testimonial[];
  duration?: number;
}) => {
  return (
    <div className={props.className}>
      <motion.div
        animate={{
          translateY: "-50%",
        }}
        transition={{
          duration: props.duration || 10,
          repeat: Infinity,
          ease: "linear",
          repeatType: "loop",
        }}
        className="flex flex-col gap-4 pb-4"
      >
        {[
          ...new Array(2).fill(0).map((_, index) => (
            <React.Fragment key={index}>
              {props.testimonials.map(({ quote, image, name, role }, i) => (
                <div 
                  className="p-6 rounded-2xl border border-stroke/40 bg-surface/80 shadow-lg shadow-accent/5 max-w-xs w-full" 
                  key={i}
                >
                  <div className="text-sm text-ink leading-relaxed">&ldquo;{quote}&rdquo;</div>
                  <div className="flex items-center gap-3 mt-4">
                    <div className="relative h-10 w-10 rounded-full overflow-hidden ring-2 ring-stroke/30">
                      <Image
                        width={40}
                        height={40}
                        src={image}
                        alt={name}
                        className="h-full w-full object-cover"
                      />
                    </div>
                    <div className="flex flex-col">
                      <div className="font-semibold text-sm text-ink leading-5">{name}</div>
                      <div className="text-xs text-ink-muted leading-5">{role}</div>
                    </div>
                  </div>
                </div>
              ))}
            </React.Fragment>
          )),
        ]}
      </motion.div>
    </div>
  );
};
