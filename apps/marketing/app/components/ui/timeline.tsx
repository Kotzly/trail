"use client";

import { useScroll, useTransform, motion } from "framer-motion";
import React, { useEffect, useRef, useState } from "react";
import { Check, Circle, Sparkles } from "lucide-react";

export interface TimelineItem {
  title: string;
  description: string;
  status: "completed" | "in_progress" | "planned" | "future";
  highlights: string[];
}

interface TimelineProps {
  items: TimelineItem[];
}

const statusIcons = {
  completed: Check,
  in_progress: Circle,
  planned: Circle,
  future: Sparkles,
};

const statusClasses = {
  completed: "text-accent",
  in_progress: "text-accent/70",
  planned: "text-ink-subtle",
  future: "text-ink-subtle",
};

const statusDotClasses = {
  completed: "bg-accent/30 border-accent/50",
  in_progress: "bg-accent/20 border-accent/30",
  planned: "bg-surface-strong border-stroke/40",
  future: "bg-surface-strong border-stroke/40",
};

export const Timeline = ({ items }: TimelineProps) => {
  const ref = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState(0);

  useEffect(() => {
    if (ref.current) {
      const rect = ref.current.getBoundingClientRect();
      setHeight(rect.height);
    }
  }, [ref]);

  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start 10%", "end 50%"],
  });

  const heightTransform = useTransform(scrollYProgress, [0, 1], [0, height]);
  const opacityTransform = useTransform(scrollYProgress, [0, 0.1], [0, 1]);

  return (
    <div className="w-full md:px-10" ref={containerRef}>
      <div ref={ref} className="relative max-w-7xl mx-auto pb-20">
        {items.map((item, index) => {
          const Icon = statusIcons[item.status];
          return (
            <div
              key={index}
              className="flex justify-start pt-10 md:pt-40 md:gap-10"
            >
              <div className="sticky flex flex-col md:flex-row z-40 items-center top-40 self-start max-w-xs lg:max-w-sm md:w-full">
                <div
                  className={`h-10 absolute left-3 md:left-3 w-10 rounded-full bg-surface flex items-center justify-center border ${statusDotClasses[item.status]}`}
                >
                  <Icon
                    className={`h-4 w-4 p-2 ${statusClasses[item.status]}`}
                  />
                </div>
                <h3 className="hidden md:block text-xl md:pl-20 md:text-3xl font-bold text-ink-subtle">
                  {item.title}
                </h3>
              </div>

              <div className="relative pl-20 pr-4 md:pl-4 w-full">
                <h3 className="md:hidden block text-2xl mb-4 text-left font-bold text-ink-subtle">
                  {item.title}
                </h3>
                <div className="space-y-4">
                  <p className="text-ink-muted text-sm md:text-base leading-relaxed">
                    {item.description}
                  </p>
                  <div className="space-y-2">
                    {item.highlights.map((highlight, i) => (
                      <div
                        key={i}
                        className="flex items-center gap-2 text-sm text-ink-muted"
                      >
                        <Icon
                          className={`h-4 w-4 flex-shrink-0 ${statusClasses[item.status]}`}
                        />
                        {highlight}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
        <div
          style={{ height: height + "px" }}
          className="absolute md:left-8 left-8 top-0 overflow-hidden w-[2px] bg-[linear-gradient(to_bottom,var(--tw-gradient-stops))] from-transparent from-[0%] via-stroke to-transparent to-[99%] [mask-image:linear-gradient(to_bottom,transparent_0%,black_10%,black_90%,transparent_100%)]"
        >
          <motion.div
            style={{ height: heightTransform, opacity: opacityTransform }}
            className="absolute inset-x-0 top-0 w-[2px] bg-gradient-to-t from-accent via-cta to-transparent from-[0%] via-[10%] rounded-full"
          />
        </div>
      </div>
    </div>
  );
};
