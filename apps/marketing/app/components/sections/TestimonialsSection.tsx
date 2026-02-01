"use client";

import { motion } from "framer-motion";
import Image from "next/image";
import { marketingCopy } from "@trail/content";

interface Testimonial {
  name: string;
  role: string;
  quote: string;
  image: string;
}

const allTestimonials: Testimonial[] = [...marketingCopy.testimonials];
const firstColumn = allTestimonials.slice(0, 3);
const secondColumn = allTestimonials.slice(3, 6);
const thirdColumn = allTestimonials.slice(6, 9);

interface TestimonialCardProps {
  quote: string;
  name: string;
  role: string;
  image: string;
}

function TestimonialCard({ quote, name, role, image }: TestimonialCardProps) {
  return (
    <div className="group rounded-2xl border border-stroke/40 bg-surface/60 p-6 transition-all duration-300 hover:border-accent/30 hover:shadow-lg hover:shadow-accent/5">
      <div className="flex gap-1 text-accent">
        {[...Array(5)].map((_, i) => (
          <svg key={i} className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
          </svg>
        ))}
      </div>
      <p className="mt-4 text-sm leading-relaxed text-ink/80">
        &ldquo;{quote}&rdquo;
      </p>
      <div className="mt-6 flex items-center gap-3">
        <div className="relative h-10 w-10 overflow-hidden rounded-full ring-2 ring-stroke/40">
          <Image
            src={image}
            alt={name}
            fill
            className="object-cover"
            sizes="40px"
          />
        </div>
        <div>
          <p className="text-sm font-medium text-ink">{name}</p>
          <p className="text-xs text-ink-subtle">{role}</p>
        </div>
      </div>
    </div>
  );
}

interface TestimonialsColumnProps {
  testimonials: Testimonial[];
  className?: string;
}

function TestimonialsColumn({ testimonials, className = "" }: TestimonialsColumnProps) {
  return (
    <div className={`flex flex-col gap-4 ${className}`}>
      {testimonials.map((testimonial, index) => (
        <TestimonialCard
          key={index}
          quote={testimonial.quote}
          name={testimonial.name}
          role={testimonial.role}
          image={testimonial.image}
        />
      ))}
    </div>
  );
}

export function TestimonialsSection() {
  const { testimonialsSection } = marketingCopy;

  return (
    <section className="relative overflow-hidden px-6 py-24">
      {/* Background gradient */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute bottom-0 left-1/4 h-[600px] w-[600px] rounded-full bg-accent/3 blur-3xl" />
        <div className="absolute right-1/4 top-0 h-[500px] w-[500px] rounded-full bg-accent/3 blur-3xl" />
      </div>

      <div className="relative mx-auto max-w-6xl">
        {/* Section header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="mb-16 text-center"
        >
          <span className="inline-block text-xs font-semibold uppercase tracking-wider text-accent">
            {testimonialsSection.eyebrow}
          </span>
          <h2 className="mt-4 text-3xl font-semibold tracking-tight text-ink md:text-4xl">
            {testimonialsSection.title}
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-ink-muted">
            {testimonialsSection.summary}
          </p>
        </motion.div>

        {/* Testimonials grid */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3"
        >
          <TestimonialsColumn testimonials={firstColumn} />
          <TestimonialsColumn testimonials={secondColumn} className="md:mt-8" />
          <TestimonialsColumn testimonials={thirdColumn} className="hidden lg:block lg:mt-16" />
        </motion.div>
      </div>
    </section>
  );
}
