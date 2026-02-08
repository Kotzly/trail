"use client";

import * as React from "react";
import { motion } from "motion/react";
import { marketingCopy } from "@trail/content";
import { TrailLogo } from "../../components/TrailLogo";
import { GetTrailButton } from "./GetTrailButton";

const navItems = [
  {
    href: "/#features",
    label: marketingCopy.nav.features,
  },
  {
    href: "/#faq",
    label: marketingCopy.nav.faq,
  },
];

export function MarketingNav() {
  const headerRef = React.useRef<HTMLElement | null>(null);
  const [isHeaderVisible, setIsHeaderVisible] = React.useState(true);

  React.useEffect(() => {
    const headerEl = headerRef.current;
    if (!headerEl || typeof IntersectionObserver === "undefined") return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsHeaderVisible(entry.isIntersecting);
      },
      { threshold: 0.01 },
    );

    observer.observe(headerEl);

    return () => observer.disconnect();
  }, []);

  return (
    <>
      <header ref={headerRef} className="relative z-30">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <motion.a
            href="/"
            className="flex items-center gap-2.5 rounded-full text-lg font-display font-semibold tracking-tight text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:ring-offset-2 focus-visible:ring-offset-base"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
          >
            <TrailLogo className="trail-logo--md" />
            Trail
          </motion.a>

          <nav className="flex items-center gap-4 text-sm font-medium text-ink-subtle sm:gap-6">
            {navItems.map((item) => (
              <motion.a
                key={item.href}
                href={item.href}
                className="rounded-full transition hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:ring-offset-2 focus-visible:ring-offset-base"
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, ease: "easeInOut" }}
              >
                {item.label}
              </motion.a>
            ))}
          </nav>
        </div>
      </header>

      <motion.div
        aria-hidden={isHeaderVisible}
        className="fixed right-4 top-4 z-50"
        initial={{ opacity: 0, y: -12 }}
        animate={
          isHeaderVisible ? { opacity: 0, y: -12 } : { opacity: 1, y: 0 }
        }
        transition={{ duration: 0.2, ease: "easeOut" }}
        style={{ pointerEvents: isHeaderVisible ? "none" : "auto" }}
      >
        <GetTrailButton
          href="/downloads"
          showIcon={false}
          className="h-10 px-5 shadow-[var(--trail-elev-3)]"
        >
          Get Trail
        </GetTrailButton>
      </motion.div>
    </>
  );
}
