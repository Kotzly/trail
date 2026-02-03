"use client";

import { motion } from "framer-motion";
import { TestimonialsColumn, Testimonial } from "../ui/testimonials-columns";
import testimonialsData from "../../data/testimonials.json";

export function TestimonialsSection() {
  const { title, subtitle, description, items } = testimonialsData;

  // Split testimonials into 3 columns
  const firstColumn = items.slice(0, 3) as unknown as Testimonial[];
  const secondColumn = items.slice(3, 6) as unknown as Testimonial[];
  const thirdColumn = items.slice(6, 9) as unknown as Testimonial[];

  return (
    <section className="relative py-20 lg:py-32 overflow-hidden">
      {/* Background gradient */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute bottom-0 left-1/4 h-[600px] w-[600px] rounded-full bg-accent/3 blur-3xl" />
        <div className="absolute right-1/4 top-0 h-[500px] w-[500px] rounded-full bg-accent/3 blur-3xl" />
      </div>

      <div className="relative container mx-auto px-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="flex flex-col items-center justify-center max-w-[540px] mx-auto mb-10"
        >
          <div className="flex justify-center">
            <div className="border border-stroke/40 py-1 px-4 rounded-full text-xs font-medium text-ink-subtle uppercase tracking-wider">
              {title}
            </div>
          </div>

          <h2 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-bold tracking-tight mt-5 text-ink">
            {subtitle}
          </h2>
          <p className="text-center mt-3 text-ink-muted max-w-sm">
            {description}
          </p>
        </motion.div>

        {/* Testimonials Columns */}
        <div className="flex justify-center gap-6 [mask-image:linear-gradient(to_bottom,transparent,black_25%,black_75%,transparent)] max-h-[740px] overflow-hidden">
          <TestimonialsColumn testimonials={firstColumn} duration={15} />
          <TestimonialsColumn testimonials={secondColumn} className="hidden md:block" duration={19} />
          <TestimonialsColumn testimonials={thirdColumn} className="hidden lg:block" duration={17} />
        </div>
      </div>
    </section>
  );
}
