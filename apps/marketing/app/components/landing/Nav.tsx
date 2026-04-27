"use client";

import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { TrailMark } from "./TrailMark";

const easeOut = [0.23, 1, 0.32, 1] as const;

export function LandingNav({ ctaHref = "#cta" }: { ctaHref?: string }) {
  const [scrolled, setScrolled] = useState(false);
  const reduce = useReducedMotion();

  useEffect(() => {
    const onScroll = () =>
      setScrolled(window.scrollY > window.innerHeight * 0.5);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <motion.nav
      initial={reduce ? false : { opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: easeOut, delay: 0.3 }}
      className="fixed inset-x-0 top-0 z-50 transition-[background-color,border-color] duration-[350ms] ease-out"
      style={{
        backgroundColor: scrolled ? "rgba(10, 9, 8, 0.92)" : "transparent",
        borderBottom: scrolled
          ? "1px solid rgba(246, 239, 225, 0.06)"
          : "1px solid transparent",
      }}
    >
      <div className="mx-auto flex max-w-[1280px] items-center justify-between px-6 py-4 md:px-8">
        <a
          href="#"
          className="flex items-center gap-2.5 outline-none focus-visible:ring-2 focus-visible:ring-[var(--landing-ember)] rounded"
        >
          <TrailMark size={28} />
          <span className="font-serif text-[22px] font-medium tracking-[-0.01em] text-[var(--landing-ink)]">
            Trail
          </span>
        </a>

        <div className="hidden items-center gap-8 sm:flex">
          <a
            href="#features"
            className="text-[13px] font-medium text-[var(--landing-ink-2)] transition-colors duration-200 hover:text-[var(--landing-ink)]"
          >
            Features
          </a>
          <a
            href="#try"
            className="text-[13px] font-medium text-[var(--landing-ink-2)] transition-colors duration-200 hover:text-[var(--landing-ink)]"
          >
            Try it
          </a>
        </div>

        <a
          href={ctaHref}
          className="group relative inline-flex items-center gap-2 rounded-full bg-[var(--landing-ink)] px-4 py-2 text-[13px] font-semibold text-[#0a0908] shadow-[0_0_0_1px_rgba(246,239,225,0.1)] transition-transform duration-200 ease-out hover:-translate-y-px active:scale-[0.97]"
        >
          Add to Chrome
        </a>
      </div>
    </motion.nav>
  );
}
