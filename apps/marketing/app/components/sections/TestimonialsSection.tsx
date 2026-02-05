"use client";

import { TestimonialsSection } from "@trail/ui/marketing";
import { testimonials } from "../../data/testimonials";

export default function Testimonials() {
  return <TestimonialsSection testimonials={testimonials} />;
}
