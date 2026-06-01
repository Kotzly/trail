"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence, useReducedMotion } from "motion/react";
import { useTranslations } from "next-intl";
import { TrailMark } from "./TrailMark";

const easeOut = [0.23, 1, 0.32, 1] as const;

export type NavLink = { label: string; href: string; isExternal?: boolean };

function isInternalPath(href: string) {
  return href.startsWith("/") && !href.startsWith("//");
}

export function LandingNav({
  links,
  ctaText,
  ctaHref = "/#cta",
}: {
  links?: NavLink[];
  ctaText?: string;
  ctaHref?: string;
} = {}) {
  const tNav = useTranslations("nav");
  const resolvedLinks: NavLink[] = links ?? [
    { label: tNav("features"), href: "/#features" },
    { label: tNav("tryIt"), href: "/#try" },
  ];
  const resolvedCtaText = ctaText ?? tNav("install");
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const reduce = useReducedMotion();
  const ctaIsExternal = /^https?:\/\//.test(ctaHref);
  const ctaExternalAttrs = ctaIsExternal
    ? { target: "_blank", rel: "noopener noreferrer" }
    : {};

  useEffect(() => {
    const onScroll = () =>
      setScrolled(window.scrollY > window.innerHeight * 0.5);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (mobileOpen) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = prev;
      };
    }
  }, [mobileOpen]);

  useEffect(() => {
    if (!mobileOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMobileOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mobileOpen]);

  return (
    <>
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
          <Link
            href="/"
            className="flex items-center gap-2.5 outline-none focus-visible:ring-2 focus-visible:ring-[var(--landing-ember)] rounded"
          >
            <TrailMark size={28} />
            <span className="font-serif text-[22px] font-medium tracking-[-0.01em] text-[var(--landing-ink)]">
              Trail
            </span>
          </Link>

          <div className="hidden items-center gap-8 sm:flex">
            {resolvedLinks.map((link) =>
              !link.isExternal && isInternalPath(link.href) ? (
                <Link
                  key={link.href}
                  href={link.href}
                  className="text-[13px] font-medium text-[var(--landing-ink-2)] transition-colors duration-200 hover:text-[var(--landing-ink)]"
                >
                  {link.label}
                </Link>
              ) : (
                <a
                  key={link.href}
                  href={link.href}
                  className="text-[13px] font-medium text-[var(--landing-ink-2)] transition-colors duration-200 hover:text-[var(--landing-ink)]"
                  {...(link.isExternal
                    ? { target: "_blank", rel: "noopener noreferrer" }
                    : {})}
                >
                  {link.label}
                </a>
              ),
            )}
          </div>

          <div className="flex items-center gap-2">
            {resolvedCtaText ? (
              <a
                href={ctaHref}
                {...ctaExternalAttrs}
                className="group relative inline-flex items-center gap-2 rounded-full bg-[var(--landing-ink)] px-4 py-2 text-[13px] font-semibold text-[#0a0908] shadow-[0_0_0_1px_rgba(246,239,225,0.1)] transition-transform duration-200 ease-out hover:-translate-y-px active:scale-[0.97]"
              >
                {resolvedCtaText}
              </a>
            ) : null}

            {resolvedLinks.length > 0 ? (
              <button
                type="button"
                onClick={() => setMobileOpen(true)}
                className="grid h-9 w-9 place-items-center rounded text-[var(--landing-ink-2)] transition-colors duration-200 hover:text-[var(--landing-ink)] sm:hidden"
                aria-label={tNav("openMenu")}
              >
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 18 18"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.4"
                  aria-hidden="true"
                >
                  <line x1="3" y1="6" x2="15" y2="6" />
                  <line x1="3" y1="12" x2="15" y2="12" />
                </svg>
              </button>
            ) : null}
          </div>
        </div>
      </motion.nav>

      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            className="fixed inset-0 z-[60] flex flex-col bg-[var(--landing-bg)]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2, ease: easeOut }}
          >
            <div className="flex items-center justify-between px-6 py-4">
              <Link
                href="/"
                onClick={() => setMobileOpen(false)}
                className="flex items-center gap-2.5"
              >
                <TrailMark size={28} />
                <span className="font-serif text-[22px] font-medium tracking-[-0.01em] text-[var(--landing-ink)]">
                  Trail
                </span>
              </Link>
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                className="grid h-9 w-9 place-items-center rounded text-[var(--landing-ink-2)] transition-colors duration-200 hover:text-[var(--landing-ink)]"
                aria-label={tNav("closeMenu")}
              >
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 20 20"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.4"
                  aria-hidden="true"
                >
                  <line x1="5" y1="5" x2="15" y2="15" />
                  <line x1="15" y1="5" x2="5" y2="15" />
                </svg>
              </button>
            </div>

            <nav
              aria-label={tNav("primary")}
              className="flex flex-1 flex-col justify-center gap-7 px-8"
            >
              {resolvedLinks.map((link, i) => {
                const isInternal =
                  !link.isExternal && isInternalPath(link.href);
                const className =
                  "font-serif text-[clamp(40px,11vw,64px)] font-normal leading-[1.02] tracking-[-0.025em] text-[var(--landing-ink)] transition-colors duration-200 hover:text-[var(--landing-ember)]";
                return (
                  <motion.div
                    key={link.href}
                    initial={{ opacity: 0, y: 14 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{
                      delay: 0.1 + i * 0.06,
                      duration: 0.45,
                      ease: easeOut,
                    }}
                  >
                    {isInternal ? (
                      <Link
                        href={link.href}
                        onClick={() => setMobileOpen(false)}
                        className={className}
                      >
                        {link.label}
                      </Link>
                    ) : (
                      <a
                        href={link.href}
                        onClick={() => setMobileOpen(false)}
                        className={className}
                        {...(link.isExternal
                          ? { target: "_blank", rel: "noopener noreferrer" }
                          : {})}
                      >
                        {link.label}
                      </a>
                    )}
                  </motion.div>
                );
              })}
            </nav>

            {resolvedCtaText ? (
              <motion.div
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  delay: 0.1 + resolvedLinks.length * 0.06,
                  duration: 0.45,
                  ease: easeOut,
                }}
                className="px-8 pb-10"
              >
                <a
                  href={ctaHref}
                  {...ctaExternalAttrs}
                  onClick={() => setMobileOpen(false)}
                  className="inline-flex items-center justify-center rounded-full bg-[var(--landing-ink)] px-6 py-3 text-[14px] font-semibold text-[#0a0908] active:scale-[0.97]"
                >
                  {resolvedCtaText}
                </a>
              </motion.div>
            ) : null}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
