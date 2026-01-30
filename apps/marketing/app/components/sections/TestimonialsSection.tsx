import { marketingCopy } from "@trail/content";
import { TestimonialsColumn } from "../ui/testimonials-columns";

export function TestimonialsSection() {
  const { testimonialsSection, testimonials } = marketingCopy;

  const normalized = testimonials.map((testimonial) => ({
    text: testimonial.quote,
    image: testimonial.image,
    name: testimonial.name,
    role: testimonial.role
  }));

  const columnSize = Math.ceil(normalized.length / 3);
  const firstColumn = normalized.slice(0, columnSize);
  const secondColumn = normalized.slice(columnSize, columnSize * 2);
  const thirdColumn = normalized.slice(columnSize * 2);

  return (
    <section id="testimonials" className="px-6 py-20">
      <div className="mx-auto max-w-6xl">
        <div className="max-w-2xl">
          <span className="trail-eyebrow text-ink-subtle">
            {testimonialsSection.eyebrow}
          </span>
          <h2 className="trail-title mt-3">{testimonialsSection.title}</h2>
          <p className="trail-copy mt-3">{testimonialsSection.summary}</p>
        </div>

        <div className="mt-10 flex justify-center gap-6 [mask-image:linear-gradient(to_bottom,transparent,black_18%,black_82%,transparent)] max-h-[740px] overflow-hidden">
          <TestimonialsColumn testimonials={firstColumn} duration={16} />
          <TestimonialsColumn
            testimonials={secondColumn}
            className="hidden md:block"
            duration={20}
          />
          <TestimonialsColumn
            testimonials={thirdColumn}
            className="hidden lg:block"
            duration={18}
          />
        </div>
      </div>
    </section>
  );
}
