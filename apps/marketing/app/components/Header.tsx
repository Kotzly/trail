"use client";

import { useEffect, useState } from "react";
import {
  motion,
  AnimatePresence,
  useScroll,
  useMotionValueEvent,
} from "motion/react";

const ease = [0.25, 0.1, 0.25, 1] as const;

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
      <motion.header className="fixed top-0 left-0 right-0 z-50" initial={false}>
        <motion.nav
          className="mx-4 sm:mx-auto flex items-center justify-between"
          animate={
            scrolled
              ? {
                  maxWidth: 600,
                  paddingLeft: 24,
                  paddingRight: 24,
                  paddingTop: 10,
                  paddingBottom: 10,
                  marginTop: 12,
                  borderRadius: 9999,
                  backgroundColor: "rgba(0, 0, 0, 0.6)",
                  borderWidth: 1,
                  borderColor: "rgba(255, 255, 255, 0.08)",
                  backdropFilter: "blur(24px)",
                }
              : {
                  maxWidth: 1200,
                  paddingLeft: 24,
                  paddingRight: 24,
                  paddingTop: 20,
                  paddingBottom: 20,
                  marginTop: 0,
                  borderRadius: 0,
                  backgroundColor: "rgba(0, 0, 0, 0)",
                  borderWidth: 0,
                  borderColor: "rgba(255, 255, 255, 0)",
                  backdropFilter: "blur(0px)",
                }
          }
          transition={{ duration: 0.5, ease }}
          style={{ borderStyle: "solid" }}
        >
          <a href="/" className="text-text-primary font-semibold tracking-heading text-lg">
            Trail
          </a>

          {/* Desktop nav */}
          <div className="hidden sm:flex items-center gap-6">
            {links.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="text-sm text-text-secondary hover:text-text-primary transition-colors tracking-body"
                {...(link.isExternal ? { target: "_blank", rel: "noopener noreferrer" } : {})}
              >
                {link.label}
              </a>
            ))}

            {ctaText && ctaHref && (
              <a
                href={ctaHref}
                className="rounded-full bg-primary px-5 py-2 text-sm font-medium text-primary-foreground transition-shadow hover:shadow-[0_0_24px_rgba(212,22,108,0.25)] active:scale-[0.98]"
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
        </motion.nav>
      </motion.header>

      {/* Mobile full-screen overlay */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            className="fixed inset-0 z-[60] bg-black/90 backdrop-blur-xl flex flex-col items-center justify-center gap-8"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
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
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 + i * 0.08, duration: 0.4, ease }}
              >
                <a
                  href={link.href}
                  onClick={() => setMobileOpen(false)}
                  className="text-2xl tracking-heading font-medium text-text-primary hover:text-magenta transition-colors"
                  {...(link.isExternal ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                >
                  {link.label}
                </a>
              </motion.div>
            ))}

            {ctaText && ctaHref && (
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 + links.length * 0.08, duration: 0.4, ease }}
              >
                <a
                  href={ctaHref}
                  onClick={() => setMobileOpen(false)}
                  className="rounded-full bg-primary px-8 py-3 text-base font-medium text-primary-foreground transition-shadow hover:shadow-[0_0_24px_rgba(212,22,108,0.25)] active:scale-[0.98]"
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
