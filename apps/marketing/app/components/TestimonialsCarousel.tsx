"use client";

import * as React from "react";

import { marketingCopy } from "@trail/content";
import { cn } from "@trail/ui";

const AUTO_INTERVAL = 5200;

function useReducedMotion() {
  const [prefersReducedMotion, setPrefersReducedMotion] = React.useState(false);

  React.useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updatePreference = () => setPrefersReducedMotion(mediaQuery.matches);

    updatePreference();

    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener("change", updatePreference);
      return () => mediaQuery.removeEventListener("change", updatePreference);
    }

    mediaQuery.addListener(updatePreference);
    return () => mediaQuery.removeListener(updatePreference);
  }, []);

  return prefersReducedMotion;
}

export function TestimonialsCarousel() {
  const { testimonials } = marketingCopy;
  const total = testimonials.length;
  const [activeIndex, setActiveIndex] = React.useState(0);
  const [isPaused, setIsPaused] = React.useState(false);
  const [autoplayEnabled, setAutoplayEnabled] = React.useState(true);
  const reducedMotion = useReducedMotion();
  const trackRef = React.useRef<HTMLDivElement | null>(null);

  const isAutoplaying = autoplayEnabled && !isPaused && !reducedMotion && total > 1;

  React.useEffect(() => {
    if (!isAutoplaying) {
      return;
    }

    const id = window.setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % total);
    }, AUTO_INTERVAL);

    return () => window.clearInterval(id);
  }, [isAutoplaying, total]);

  React.useEffect(() => {
    const track = trackRef.current;
    if (!track) {
      return;
    }

    const target = track.querySelector<HTMLElement>(`[data-index="${activeIndex}"]`);
    if (!target) {
      return;
    }

    track.scrollTo({
      left: target.offsetLeft,
      behavior: reducedMotion ? "auto" : "smooth"
    });
  }, [activeIndex, reducedMotion]);

  const handlePrev = () => {
    setActiveIndex((prev) => (prev - 1 + total) % total);
  };

  const handleNext = () => {
    setActiveIndex((prev) => (prev + 1) % total);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      handlePrev();
    }
    if (event.key === "ArrowRight") {
      event.preventDefault();
      handleNext();
    }
  };

  return (
    <section className="mx-auto max-w-6xl px-6 pb-10 pt-6 reveal">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-3">
          <p className="trail-eyebrow text-ink-subtle">Testimonials</p>
          <h2 className="trail-title text-ink">Teams move faster with Trail.</h2>
          <p className="trail-copy max-w-2xl">
            Real workflows, real momentum. Here is how Trail helps researchers and product teams stay
            aligned.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handlePrev}
            aria-label="Previous testimonial"
            className="flex h-10 w-10 items-center justify-center rounded-full border border-stroke/50 bg-surface/60 text-ink transition hover:border-stroke"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M15 6l-6 6 6 6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <button
            type="button"
            onClick={handleNext}
            aria-label="Next testimonial"
            className="flex h-10 w-10 items-center justify-center rounded-full border border-stroke/50 bg-surface/60 text-ink transition hover:border-stroke"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <button
            type="button"
            onClick={() => setAutoplayEnabled((prev) => !prev)}
            aria-pressed={autoplayEnabled}
            disabled={reducedMotion}
            className="hidden items-center gap-2 rounded-full border border-stroke/50 bg-surface/60 px-4 py-2 text-xs font-semibold text-ink-subtle transition hover:border-stroke sm:inline-flex"
          >
            {reducedMotion ? "Auto-scroll off" : autoplayEnabled ? "Pause" : "Play"}
          </button>
        </div>
      </div>

      <div
        ref={trackRef}
        role="region"
        aria-roledescription="carousel"
        aria-label="Trail testimonials"
        aria-live="polite"
        tabIndex={0}
        onKeyDown={handleKeyDown}
        onMouseEnter={() => setIsPaused(true)}
        onMouseLeave={() => setIsPaused(false)}
        onFocusCapture={() => setIsPaused(true)}
        onBlurCapture={() => setIsPaused(false)}
        className="carousel-track mt-8 flex snap-x snap-mandatory gap-6 overflow-x-auto pb-4 pr-4 [-ms-overflow-style:none] [scrollbar-width:none]"
      >
        {testimonials.map((testimonial, index) => (
          <article
            key={testimonial.name}
            data-index={index}
            className={cn(
              "min-w-[260px] snap-start rounded-3xl border border-stroke/30 bg-surface/70 p-6 shadow-elev-1 backdrop-blur-sm sm:min-w-[320px] lg:min-w-[360px]",
              index === activeIndex ? "border-ink/20" : "border-stroke/30"
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
                <p className="text-sm font-semibold text-ink">{testimonial.name}</p>
                <p className="text-xs text-ink-subtle">{testimonial.role}</p>
              </div>
            </div>
            <p className="mt-4 text-sm text-ink">
              &ldquo;{testimonial.quote}&rdquo;
            </p>
          </article>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
        <p className="text-xs text-ink-subtle">
          Auto-scroll {reducedMotion ? "disabled" : autoplayEnabled ? "on" : "paused"}.
          Drag or use arrows to browse.
        </p>
        <div className="flex items-center gap-2">
          {testimonials.map((_, index) => (
            <button
              key={`dot-${index}`}
              type="button"
              aria-label={`Go to testimonial ${index + 1}`}
              onClick={() => setActiveIndex(index)}
              className={cn(
                "h-2.5 w-2.5 rounded-full transition",
                index === activeIndex ? "bg-ink" : "bg-ink/30 hover:bg-ink/50"
              )}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
