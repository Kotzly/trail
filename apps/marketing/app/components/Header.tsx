"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  motion,
  AnimatePresence,
  useScroll,
  useMotionValueEvent,
} from "motion/react";

function isInternalPath(href: string) {
  return href.startsWith("/") && !href.startsWith("//");
}

const ease = [0.23, 1, 0.32, 1] as const;

type NavLink = { label: string; href: string; isExternal?: boolean };

export function Header({
  navLinks,
  ctaText,
  ctaHref,
}: {
  navLinks?: NavLink[];
  ctaText?: string;
  ctaHref?: string;
}) {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { scrollY } = useScroll();

  useMotionValueEvent(scrollY, "change", (latest) => {
    setScrolled(latest > 80);
  });

  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileOpen]);

  const links = navLinks ?? [
    { label: "Features", href: "#features" },
    { label: "Get Trail", href: "#cta" },
  ];

  return (
    <>
      <header className="fixed top-0 left-0 right-0 z-50">
        <nav
          aria-label="Primary"
          data-scrolled={scrolled || undefined}
          className="
            mx-auto flex items-center justify-between gap-4
            px-6 py-5 max-w-[1200px] border border-transparent
            transition-[max-width,padding,margin,background-color,border-color] duration-[450ms]
            data-[scrolled]:mx-3 data-[scrolled]:sm:mx-auto
            data-[scrolled]:max-w-[min(640px,calc(100vw-24px))]
            data-[scrolled]:py-2.5 data-[scrolled]:px-5 data-[scrolled]:mt-3
            data-[scrolled]:rounded-full
            data-[scrolled]:bg-[rgba(10,9,8,0.78)]
            data-[scrolled]:border-border-subtle
          "
          style={{ transitionTimingFunction: "cubic-bezier(0.23,1,0.32,1)" }}
        >
          <Link
            href="/"
            className="font-serif text-lg font-medium tracking-tight text-text-primary"
          >
            Trail
          </Link>

          {/* Desktop nav */}
          <div className="hidden items-center gap-6 sm:flex">
            {links.map((link) =>
              !link.isExternal && isInternalPath(link.href) ? (
                <Link
                  key={link.href}
                  href={link.href}
                  className="text-sm text-text-secondary hover:text-text-primary transition-colors tracking-body"
                >
                  {link.label}
                </Link>
              ) : (
                <a
                  key={link.href}
                  href={link.href}
                  className="text-sm text-text-secondary hover:text-text-primary transition-colors tracking-body"
                  {...(link.isExternal
                    ? { target: "_blank", rel: "noopener noreferrer" }
                    : {})}
                >
                  {link.label}
                </a>
              ),
            )}

            {ctaText && ctaHref && (
              <a
                href={ctaHref}
                className="rounded-full bg-primary px-5 py-2 text-sm font-medium text-primary-foreground transition-shadow hover:shadow-[0_18px_48px_-12px_var(--ember-glow)] active:scale-[0.98]"
              >
                {ctaText}
              </a>
            )}
          </div>

          {/* Mobile burger */}
          <button
            onClick={() => setMobileOpen(true)}
            className="sm:hidden p-2 text-text-secondary hover:text-text-primary transition-colors"
            aria-label="Open menu"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 20 20"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
            >
              <line x1="3" y1="6" x2="17" y2="6" />
              <line x1="3" y1="10" x2="17" y2="10" />
              <line x1="3" y1="14" x2="17" y2="14" />
            </svg>
          </button>
        </nav>
      </header>

      {/* Mobile full-screen overlay */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            className="fixed inset-0 z-[60] flex flex-col items-center justify-center gap-8 bg-background"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
          >
            <button
              onClick={() => setMobileOpen(false)}
              className="absolute top-6 right-6 p-2 text-text-secondary hover:text-text-primary transition-colors"
              aria-label="Close menu"
            >
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
              >
                <line x1="6" y1="6" x2="18" y2="18" />
                <line x1="18" y1="6" x2="6" y2="18" />
              </svg>
            </button>

            {links.map((link, i) => (
              <motion.div
                key={link.href}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.08 + i * 0.06, duration: 0.4, ease }}
              >
                {!link.isExternal && isInternalPath(link.href) ? (
                  <Link
                    href={link.href}
                    onClick={() => setMobileOpen(false)}
                    className="text-2xl tracking-heading font-medium text-text-primary hover:text-ember transition-colors"
                  >
                    {link.label}
                  </Link>
                ) : (
                  <a
                    href={link.href}
                    onClick={() => setMobileOpen(false)}
                    className="text-2xl tracking-heading font-medium text-text-primary hover:text-ember transition-colors"
                    {...(link.isExternal
                      ? { target: "_blank", rel: "noopener noreferrer" }
                      : {})}
                  >
                    {link.label}
                  </a>
                )}
              </motion.div>
            ))}

            {ctaText && ctaHref && (
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  delay: 0.08 + links.length * 0.06,
                  duration: 0.4,
                  ease,
                }}
              >
                <a
                  href={ctaHref}
                  onClick={() => setMobileOpen(false)}
                  className="rounded-full bg-primary px-8 py-3 text-base font-medium text-primary-foreground transition-shadow hover:shadow-[0_18px_48px_-12px_var(--ember-glow)] active:scale-[0.98]"
                >
                  {ctaText}
                </a>
              </motion.div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
