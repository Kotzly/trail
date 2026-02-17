"use client";

import {
  TestimonialsSection,
  type TestimonialItem,
} from "@trail/ui/marketing";
import { testimonials as defaultTestimonials } from "../../data/testimonials";

interface TestimonialsProps {
  testimonials?: TestimonialItem[];
}

export default function Testimonials({ testimonials }: TestimonialsProps) {
  return (
    <TestimonialsSection testimonials={testimonials ?? defaultTestimonials} />
  );
}
