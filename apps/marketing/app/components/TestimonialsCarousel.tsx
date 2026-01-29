"use client";

import * as React from "react";

import { marketingCopy } from "@trail/content";
import { cn } from "@trail/ui";

const SPEED = 0.4; // px per frame

function useReducedMotion() {
  const [prefersReducedMotion, setPrefersReducedMotion] = React.useState(false);

  React.useEffect(() => {
    if (typeof window === "undefined") return;

    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updatePreference = () => setPrefersReducedMotion(mediaQuery.matches);

    updatePreference();

    mediaQuery.addEventListener("change", updatePreference);
    return () => mediaQuery.removeEventListener("change", updatePreference);
  }, []);

  return prefersReducedMotion;
}

export function TestimonialsCarousel() {
  const { testimonials } = marketingCopy;
  const reducedMotion = useReducedMotion();

  const trackRef = React.useRef<HTMLDivElement | null>(null);
  const [isPaused, setIsPaused] = React.useState(false);

  React.useLayoutEffect(() => {
    if (reducedMotion) return;

    const track = trackRef.current;
    if (!track) return;

    let rafId: number;
    let offset = 0;

    const step = () => {
      if (!isPaused) {
        offset += SPEED;

        const next = Math.floor(offset);
        if (next > 0) {
          track.scrollLeft += next;
          offset -= next;
        }

        if (track.scrollLeft >= track.scrollWidth / 2) {
          track.scrollLeft = 0;
        }
      }

      rafId = requestAnimationFrame(step);
    };

    rafId = requestAnimationFrame(step);

    return () => cancelAnimationFrame(rafId);
  }, [isPaused, reducedMotion]);


  return (
    <section className="px-6 pb-10 pt-6 reveal">
      <div className="mx-auto max-w-6xl flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-3">
          <p className="trail-eyebrow text-ink-subtle">Testimonials</p>
          <h2 className="trail-title text-ink">
            teams move faster with Trail.
          </h2>
          <p className="trail-copy max-w-2xl">
            the totally real stories of how trail helps totally real people
          </p>
        </div>
      </div>
      <div
        ref={trackRef}
        role="region"
        aria-roledescription="carousel"
        aria-label="Trail testimonials"
        aria-live="off"
        tabIndex={0}
        onMouseEnter={() => setIsPaused(true)}
        onMouseLeave={() => setIsPaused(false)}
        onFocusCapture={() => setIsPaused(true)}
        onBlurCapture={() => setIsPaused(false)}
        className="
          mt-8 flex gap-6 overflow-x-auto pb-4 pr-4
          [-ms-overflow-style:none] [scrollbar-width:none]
          overscroll-x-contain touch-pan-x
        "
      >
        {[...testimonials, ...testimonials].map((testimonial, index) => (
          <article
            key={`${testimonial.name}-${index}`}
            className={cn(
              "min-w-[260px] rounded-3xl border border-stroke/30 bg-surface/70 p-6 shadow-elev-1 backdrop-blur-sm",
              "sm:min-w-[320px] lg:min-w-[360px]"
            )}
          >
            <div className="flex items-center gap-4">
              <img
                src={testimonial.image}
                alt={testimonial.name}
                className="h-12 w-12 rounded-full object-cover"
                loading="lazy"
                decoding="async"
              />
              <div>
                <p className="text-sm font-semibold text-ink">
                  {testimonial.name}
                </p>
                <p className="text-xs text-ink-subtle">
                  {testimonial.role}
                </p>
              </div>
            </div>

            <p className="mt-4 text-sm text-ink">
              &ldquo;{testimonial.quote}&rdquo;
            </p>
          </article>
        ))}
      </div>
    </section>
  );
}
